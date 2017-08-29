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