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
        it(`upload cancellation -> ${upload.localFilePath}`, async () => {
            await runTestForUpload(upload, true)
        })
    }
})

async function runTestForUpload(upload, testCancellation = false) {
    assert.string(upload.localFilePath, 'localFilePath')
    assert.string(upload.destination, 'destination')

    const localFilePath = path.resolve(__dirname, '../tests', upload.localFilePath)
    const destination = baseDir + '/' + upload.destination
    const {size} = fs.statSync(localFilePath)
    const args: any = {
        access_token: data.access_token,
        readable_stream: fs.createReadStream(localFilePath),
        file_size: size,
        destination,
        forced_chunked_upload: upload.forced_chunked_upload === undefined ? false : upload.forced_chunked_upload,
        autorename: false,
        mode: 'add',
        chunk_size: upload.chunk_size
    }
    if (testCancellation) {
        setTimeout(() => {
            args.cancel()
        }, 10)
    }

    try {
        const unit = await dropboxUpload(args)

        chai.assert.notOk(testCancellation, 'upload should have been cancelled')

        expect(unit).to.have.property('path_lower', destination.toLowerCase())
        expect(unit).to.have.property('size', size)
    } catch (err) {
        if (!testCancellation) {
            throw err
        }
        expect(err).to.have.property('message', 'user_aborted')
    }
}
