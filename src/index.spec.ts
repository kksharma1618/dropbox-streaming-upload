// tslint:disable-next-line:no-reference
/// <reference path="../node_modules/dropbox/dist/dropbox.d.ts" />
const Dropbox = require('dropbox')
const data = require('../tests/test_data.json')
import * as assert from 'assert-plus'
import * as uuid from 'uuid'
import dropboxUpload from './index'
import * as fs from 'fs'
import * as path from 'path'
import * as chai from "chai";
const expect = chai.expect

// verify data
assert.string(data.access_token, 'access_token')
assert.ok(data.access_token !== '', 'access_token')
assert.arrayOfObject(data.uploads, 'uploads')
assert.string(data.unitTestBaseFolder, 'unitTestBaseFolder')

// client
const client: DropboxTypes.Dropbox = new Dropbox({accessToken: data.access_token})
const baseDir = data.unitTestBaseFolder + '/' + uuid.v4()

before(async () => {
    await client.filesCreateFolderV2({
        path: baseDir
    })
})

after(async () => {
    await client.filesDeleteV2({
        path: baseDir
    })
})

describe('running testData.uploads', () => {
    for (const upload of data.uploads) {
        it(`upload -> ${upload.localFilePath}`, async () => {
            await runTestForUpload(upload)
        })
    }
})

async function runTestForUpload(upload) {
    assert.string(upload.localFilePath, 'localFilePath')
    assert.string(upload.destination, 'destination')

    const localFilePath = path.resolve(__dirname, '../tests', upload.localFilePath)
    const destination = baseDir + '/' + upload.destination
    const {size} = fs.statSync(localFilePath)

    const unit = await dropboxUpload({
        access_token: data.access_token,
        readable_stream: fs.createReadStream(localFilePath),
        file_size: size,
        destination,
        forced_chunked_upload: upload.forced_chunked_upload === undefined ? false : upload.forced_chunked_upload,
        autorename: false,
        mode: 'add'
    })
    expect(unit).to.have.property('path_lower', destination)
    expect(unit).to.have.property('size', size)
    
}
