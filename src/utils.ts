import * as request from 'request'

export function promiseFromCallback<T>(next: (next: (err: Error | null, value?: T) => any) => any): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        next((err, value) => {
            if (err) {
                return reject(err);
            }
            resolve(value);
        });
    });
}

export function safeParseJson(j) {
    try {
        j = JSON.parse(j)
    } catch (e) {
    }
    return j
}

export async function makeRequest(options: request.CoreOptions & request.RequiredUriUrl, throwNot200 = true): Promise<any> {
    return promiseFromCallback((next) => {
        request(options, (err, resp, body) => {
            if (err) {
                return next(err)
            }
            if (resp.statusCode !== 200 && throwNot200) {
                return next(getHttpError(resp.statusCode, body))
            }
            if (throwNot200) {
                return next(null, safeParseJson(body))
            }
            next(null, {
                statusCode: resp.statusCode,
                body: safeParseJson(body)
            })
        })
    })
}

export function getHttpError(statusCode, body) {
    const sbody = typeof body === 'object' ? JSON.stringify(body) : body
    const e = new Error(`${statusCode} ${sbody}`);
    (e as any).statusCode = statusCode;
    (e as any).body = safeParseJson(body);
    return e
}