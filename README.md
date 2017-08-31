# dropbox-streaming-upload

Streaming uploads for dropbox api v2

[Official js sdk](https://github.com/dropbox/dropbox-sdk-js) by dropbox lacks streaming upload feature. This package provide just that missing feature, nothing else.

## Installation
```
npm install --save dropbox-streaming-upload
```

## Supported features
- Simple basic upload
- Upload session for bigger files (dropbox requires upload session for files bigger than 150mb. Though you can choose it with files of any size)
- Ability to cancel upload

## Usage
``` javascript
const upload = require('dropbox-streaming-upload')
upload(options).then(function(successMetadata) {

}, function(error) {

})
```

## Options
- *access_token:* Dropbox access token.
- *readable_stream:* Readable stream to upload.
- *file_size:* Total size of upload in bytes. Since we just have the readable stream we need size information separately.
- *destination:* Destination path in dropbox where to upload the file (full file path: ie, if you are uploading roses.jpg to /weeds/ folder, then "/weeds/roses.jpg").
- *forced_chunked_upload:* By default library will use upload session if *file_size* is greater than 150mb. If you set this to true, then it will force upload session regardless of *file_size*.
- *chunk_size:* By default library will use 5mb chunk while using chunked upload. You can override it here (in bytes).
- *mute:* See dropbox [documentation](https://www.dropbox.com/developers/documentation/http/documentation#files-upload) for /upload or /upload_session/finish. Default is false.
- *autorename:* See dropbox [documentation](https://www.dropbox.com/developers/documentation/http/documentation#files-upload) for /upload or /upload_session/finish. Default is true.
- *mode:* See dropbox [documentation](https://www.dropbox.com/developers/documentation/http/documentation#files-upload) for /upload or /upload_session/finish. Default is "add".
- *client_modified:* See dropbox [documentation](https://www.dropbox.com/developers/documentation/http/documentation#files-upload) for /upload or /upload_session/finish.

## Cancelling upload
``` javascript
const upload = require('dropbox-streaming-upload')
const options = {
    access_token: 'token',
    readable_stream: someStream,
    file_size: totalSize,
    destination: '/mypath/myfile.ext',
}
upload(options).then(function(successMetadata) {

}, function(error) {
    if (error.message === 'user_aborted') {
        // you cancelled the upload below
    }
})

// when you want to cancel it (before upload is done/failed)
// cancel function is added to your options object by library
// calling cancel function after upload is done/failed has no effect
options.cancel()
```

## Unit testing
- clone this repository
- run
```
npm install
```
- copy ./sample\_test\_data.json to ./tests/test\_data.json
- fill in "access\_token"
- fill in "unitTestBaseFolder". Unit test will create a tmp folder in that folder and upload files inside that (tmp folder will be removed in the end)
- update "uploads" array as needed. structure of uploads array item:
``` json
{
    "localFilePath": "localfilepath.ext",
    "destination": "./relative/to/tmp/folder/risingearth.jpg",
    "forced_chunked_upload": false,
    "chunk_size": 5e+6
}
```
- forced\_chunked\_upload and chunk\_size are optional
- run 
```
npm test
```
