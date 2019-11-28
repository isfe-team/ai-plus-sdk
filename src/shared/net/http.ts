import { Base64 } from 'js-base64'

interface IRPCResponse<T> {
  id: number;
  jsonrpc: string;
  result?: T;
}

export interface RPCResponse<T extends TTS_RPCResponse> extends IRPCResponse<T> {
  id: number;
  jsonrpc: '2.0';
  result?: T;
}

interface Base_RPCResponse {
  ret: number;
}

export type SSB_RPCResponse = Base_RPCResponse & {
  sid: string;
}

type TXTW_RPCResponse = Base_RPCResponse

export type GRS_RPCResponse = Base_RPCResponse & {
  ttsStatus: number;
  data: string;
  [key: string]: any;
}

type SSE_RPCResponse = Base_RPCResponse

export type TTS_RPCResponse = SSB_RPCResponse | TXTW_RPCResponse | GRS_RPCResponse | SSE_RPCResponse

export default function http<T> (url: string, method: string = 'POST', param: string): Promise<T> {
  return new Promise((resolve, reject) => {
    method = method.toUpperCase()
    const xmlHttp = new XMLHttpRequest()
    xmlHttp.open(method, url, true)
    xmlHttp.timeout = 5 * 1000
    xmlHttp.setRequestHeader('Content-Type', 'application/json-rpc')
    xmlHttp.send(param)
    xmlHttp.onreadystatechange = function () {
      if (xmlHttp.readyState === 4) {
        if (xmlHttp.status >= 200 && xmlHttp.status < 300) {
          let ret = null
          try {
            ret = JSON.parse(Base64.atob(xmlHttp.responseText))
          } catch(e) {
            reject(e)
            return
          }
          resolve(ret as T)
          return
        }

        if (xmlHttp.status === 500) {
          reject(new Error('系统异常'))
          return
        }
        if (xmlHttp.status === 504) {
          reject(new Error('网络超时'))
          return
        }
        reject(new Error('请求失败'))
      }
    }
  })
}
