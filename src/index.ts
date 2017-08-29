import * as request from 'request'
import * as assert from 'assert-plus'
import {readable as isReadableStream} from 'is-stream'

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
    mode?: string
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

    if (options.forced_chunked_upload || options.file_size > chunkedUploadMinSize) { // 150 mb
        return handleChunkedUpload(options)
    } else {
        return handleSimpleUpload(options)
    }
}

async function handleChunkedUpload(options: IOptions) {

}
async function handleSimpleUpload(options: IOptions) {
    const writeStream = request.post({
        uri: `${dropboxApiBasePath}/upload`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${options.access_token}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
                path: options.destination,
                mode: options.mode || 'add',
                autorename: options.autorename === undefined ? true : options.autorename,
                mute: options.mute === undefined ? false : options.mute
            }),
        }
    })
    options.readable_stream.pipe(writeStream)
}