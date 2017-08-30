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

export async function makeRequest(options: request.CoreOptions & request.RequiredUriUrl, throwErrorIfNot2xx = true): Promise<any> {
    return promiseFromCallback((next) => {
        request(options, (err, resp, body) => {
            if (err) {
                return next(err)
            }
            const statusCode = resp.statusCode || 200
            const is2xx = statusCode >= 200 && statusCode < 300
            if (!is2xx && throwErrorIfNot2xx) {
                return next(getHttpError(statusCode, body))
            }
            next(null, {
                statusCode,
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