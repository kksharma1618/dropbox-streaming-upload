import * as request from 'request'
import * as assert from 'assert-plus'
import {readable as isReadableStream} from 'is-stream'
import { promiseFromCallback, safeParseJson, makeRequest, getHttpError} from './utils'

const chunkedUploadMinSize = 150e+6
const chunkedUploadChunkSize = 5e+6
const dropboxApiBasePath = 'https://content.dropboxapi.com/2/files'

export interface IOptions {
    access_token: string,
    readable_stream: NodeJS.ReadableStream,
    file_size: number,
    destination: string,
    forced_chunked_upload?: boolean,
    chunk_size: number,
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
        return handleChunkedUpload(options)
    } else {
        return handleSimpleUpload(options)
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

    const sessionId = await uploadSessionStart(options)
    const state = {
        done_size: 0
    }
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
async function uploadSessionAppend(options: IOptions, state) {

}