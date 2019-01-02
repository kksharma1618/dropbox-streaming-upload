import * as request from 'request'
import * as assert from 'assert-plus'
import {readable as isReadableStream} from 'is-stream'
import {Readable} from 'stream'
import { promiseFromCallback, safeParseJson, makeRequest, getHttpError, nextTick} from './utils'

const chunkedUploadMinSize = 150e+6
const chunkedUploadChunkSize = 5e+6
const dropboxApiBasePath = 'https://content.dropboxapi.com/2/files'

export interface IOptions {
    access_token: string,
    readable_stream: NodeJS.ReadableStream,
    file_size: number,
    destination: string,
    forced_chunked_upload?: boolean,
    chunk_size?: number,
    mute?: boolean,
    autorename?: boolean,
    mode?: string,
    client_modified?: string
    // tslint:disable-next-line:max-line-length
    cancel?: () => any // Do not pass this function. Library will attach cancel function here which you can use to cancel upload request. Cancelling will cancel upload and reject promise with Error object with message === "user_aborted"
}

export default async function upload(options: IOptions) {

    // verfiy options
    assert.object(options, 'options')
    assert.string(options.access_token, 'options.access_token')
    assert.ok(isReadableStream(options.readable_stream), 'options.readable_stream must be a readable stream')
    assert.number(options.file_size, 'options.file_size')
    assert.string(options.destination, 'options.destination')
    assert.optionalBool(options.forced_chunked_upload, 'options.forced_chunked_upload')
    assert.optionalBool(options.mute, 'options.mute')
    assert.optionalBool(options.autorename, 'options.autorename')
    assert.optionalString(options.mode, 'options.mode')
    assert.ok(options.cancel === undefined, 'options.cancel must be undefined. its set by this library')

    options.autorename = options.autorename === undefined ? true : options.autorename
    options.mute = options.mute === undefined ? false : options.mute
    options.mode = options.mode || 'add'
    options.chunk_size = options.chunk_size || chunkedUploadChunkSize

    if (options.forced_chunked_upload || options.file_size > chunkedUploadMinSize) { // 150 mb
        return await handleChunkedUpload(options)
    } else {
        return await handleSimpleUpload(options)
    }
}
async function handleSimpleUpload(options: IOptions) {
    return promiseFromCallback((next) => {
        const args: any = {
            path: options.destination,
            mode: options.mode,
            autorename: options.autorename,
            mute: options.mute
        }
        if (options.client_modified) {
            args.client_modified = options.client_modified
        }
        const writeStream = request.post({
            uri: `${dropboxApiBasePath}/upload`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${options.access_token}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify(args),
            }
        }, (err, resp, body) => {
            if (err) {
                return next(err)
            }
            if (resp.statusCode !== 200) {
                return next(getHttpError(resp.statusCode, body))
            }
            return next(null, safeParseJson(body))
        })
        options.cancel = () => {
            writeStream.abort()
            next(new Error("user_aborted"))
        }
        options.readable_stream.pipe(writeStream)
    })
}
async function handleChunkedUpload(options: IOptions) {

    let hasUserAborted = false
    let onCancel
    options.cancel = () => {
        hasUserAborted = true
        if (onCancel) {
            onCancel()
        }
    }

    const sessionId = await uploadSessionStart(options)
    // console.log('uploadSessionStarted', sessionId)
    let doneSize = 0
    let pendingData
    options.readable_stream.pause()
    while (!hasUserAborted && doneSize < options.file_size) {
        let doneChunkSize = 0
        const stream = new Readable({
            read(size) {
                async function step(rs) {
                    if (hasUserAborted) {
                        rs.push(null)
                        return
                    }
                    // handle prev data from last stream
                    if (pendingData) {
                        doneChunkSize += pendingData.length
                        doneSize += pendingData.length
                        // console.log('pendingData', pendingData.length, doneSize)
                        if (rs.push(pendingData)) {
                            pendingData = false
                            // can read more
                            await nextTick()
                            await step(rs)
                            return
                        }
                        pendingData = false
                    }
                    // if file is done end the stream
                    if (doneSize >= options.file_size) {
                        rs.push(null)
                        return
                    }
                    // read from main stream
                    const data = options.readable_stream.read(size)
                    // console.log('chunk', data ? data.length : 'null', doneChunkSize, doneSize)
                    // nothing right now, check again in next tick
                    if (!data) {
                        await nextTick()
                        await step(rs)
                        return
                    }
                    // has data
                    const dataSmallerThanChunkSize = data.length < options.chunk_size!
                    const dataFitsInChunkUnit = data.length + doneChunkSize <= options.chunk_size!
                    const dataWontCompleteFile = data.length + doneChunkSize < options.file_size
                    const existingDataSmallerThanChunkSize = doneChunkSize < options.chunk_size!

                    if ((!existingDataSmallerThanChunkSize) || (dataSmallerThanChunkSize && !dataFitsInChunkUnit && dataWontCompleteFile)) {
                        // need new stream
                        // - if existing data has already filled the chunk unit (!existingDataSmallerThanChunkSize)
                        // - or if dataSmallerThanChunkSize && !dataFitsInChunkUnit && dataWontCompleteFile
                        pendingData = data
                        rs.push(null)
                    } else {
                        // carry on with current stream
                        doneChunkSize += data.length
                        doneSize += data.length
                        if (rs.push(data)) {
                                // can read more
                                await nextTick()
                                await step(rs)
                                return
                        }
                    }
                }
                step(this)
            }
        })
        await uploadSessionAppend(options, sessionId, doneSize, stream, (onCancelFn) => {
            onCancel = onCancelFn
        })
    }
    if (hasUserAborted) {
        throw new Error("user_aborted")
    }
    return await uploadSessionFinish(options, sessionId, doneSize)
}
async function uploadSessionStart(options: IOptions) {
    const sessionRes = await makeRequest({
        url: `${dropboxApiBasePath}/upload_session/start`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${options.access_token}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({close: false})
        }
    })
    assert.object(sessionRes.body, 'cannot start upload session ' + JSON.stringify(sessionRes))
    assert.string(sessionRes.body.session_id, 'cannot start upload session ' + JSON.stringify(sessionRes))
    return sessionRes.body.session_id
}
async function uploadSessionAppend(options: IOptions, sessionId: string, doneSize: number, stream: NodeJS.ReadableStream, registerOnCancel) {
    return promiseFromCallback((next) => {
        const args = {
            cursor: {
                session_id: sessionId,
                offset: doneSize
            }
        }
        // console.log('uploadSessionAppend', args)
        const writeStream = request.post({
            uri: `${dropboxApiBasePath}/upload_session/append_v2`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${options.access_token}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify(args),
            }
        }, (err, resp, body) => {
            // console.log('uploadSessionAppend - r', err, body)
            if (err) {
                return next(err)
            }
            if (resp.statusCode !== 200) {
                return next(getHttpError(resp.statusCode, ''))
            }
            return next(null)
        })
        registerOnCancel(() => {
            writeStream.abort()
        })
        stream.pipe(writeStream)
    })
}
async function uploadSessionFinish(options: IOptions, sessionId: string, doneSize: number) {
    const args: any = {
        cursor: {
            session_id: sessionId,
            offset: doneSize
        },
        commit: {
            path: options.destination,
            mode: options.mode,
            autorename: options.autorename,
            mute: options.mute
        }
    }
    if (options.client_modified) {
        args.commit.client_modified = options.client_modified
    }
    // console.log('uploadSessionFinish', args)
    const res = await makeRequest({
        url: `${dropboxApiBasePath}/upload_session/finish`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${options.access_token}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify(args)
        }
    })
    // console.log('uploadSessionFinish - r', res)
    assert.object(res.body, 'cannot finish upload session ' + JSON.stringify(res))
    return res.body
}