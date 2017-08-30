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
            const is2xx = resp.statusCode >= 200 && resp.statusCode < 300
            if (!is2xx && throwErrorIfNot2xx) {
                return next(getHttpError(resp.statusCode, body))
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