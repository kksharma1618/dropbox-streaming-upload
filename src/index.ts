import * as request from 'request'
import * as assert from 'assert-plus'
import {readable as isReadableStream} from 'is-stream'
import {promiseFromCallback, safeParseJson} from './utils'

const chunkedUploadMinSize = 1.5e+8
const dropboxApiBasePath = 'https://content.dropboxapi.com/2/files'

export interface IOptions {
    access_token: string,
    readable_stream: NodeJS.ReadableStream,
    file_size: number,
    destination: string,
    forced_chunked_upload?: boolean,
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

    if (options.forced_chunked_upload || options.file_size > chunkedUploadMinSize) { // 150 mb
        return handleChunkedUpload(options)
    } else {
        return handleSimpleUpload(options)
    }
}

async function handleChunkedUpload(options: IOptions) {

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
                const sbody = typeof body === 'object' ? JSON.stringify(body) : body
                const e = new Error(`${resp.statusCode} ${sbody}`);
                (e as any).statusCode = resp.statusCode;
                (e as any).body = safeParseJson(body);
                return next(e)
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
