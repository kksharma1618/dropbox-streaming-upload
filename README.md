# dropbox-streaming-upload

Streaming uploads for dropbox api v2

[Official js](https://github.com/dropbox/dropbox-sdk-js) sdk by dropbox lacks streaming upload feature. This package provide just that missing feature, nothing else.

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
- *access_token:* Dropbox access token
- *readable_stream:* Readable stream to upload
- *file_size:* Total size of upload in bytes. Since we just have the readable stream we need size information separately
- *destination:* Destination path in dropbox where to upload the file (full file path: ie, if you are uploading roses.jpg to /weeds/ folder, then "/weeds/roses.jpg")
- *forced_chunked_upload:* By default library will use upload session if file_size is greater than 150mb. If you set this to true, then it will force upload session regardless of file_size
- *:*
- *:*
- *:*
- *:*
- *:*
- *:*
- *:*
- *:*

{
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