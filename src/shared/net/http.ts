/*!
 * http | bqliu hxli
 *
 * a simple http client, just support the current demands, not a complete http client.
 */

import { Base64 } from 'js-base64'

export interface HTTPOption {
  url: string;
  method?: string;
  param?: string;
  timeout?: number;
}

const defaultTimeout = 5 * 1000

export default function http<T> ({ url = '', method = 'post', param = '', timeout = defaultTimeout }: HTTPOption = { } as HTTPOption): Promise<T> {
  return new Promise((resolve, reject) => {
    method = method.toUpperCase()
    const xhr = new XMLHttpRequest()
    xhr.open(method, url, true)
    xhr.timeout = timeout
    xhr.setRequestHeader('Content-Type', 'application/json-rpc')
    xhr.send(param)
    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState !== xhr.DONE) {
        return
      }
      const { status } = xhr
      if ((status >= 200 && status < 300) || status === 304) {
        try {
          const ret = JSON.parse(Base64.atob(xhr.responseText))
          resolve(ret as T)
        } catch(e) {
          reject(e)
        }
        return
      }

      reject(xhr)
    })
  })
}
