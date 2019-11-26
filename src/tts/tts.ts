const ttsStatus = {
  'idle': 'idle', //空闲
  'sessionBegin': 'ssb', //session begin 会话开始
  'textPut': 'txtw', //text put 写入文本
  'getResult': 'grs', //get result 获取结果
  'sessionEnd': 'sse' //session end 会话结束
}

function identity<T> (x: T) {
  return x
}

export default class TTS {
  httpApi: any
  text: string
  url: string
  serverParams: Object
  extendParams: Object
  status: string
  session: Object
  audioProc: Function
  syncid: number
  header: Array<Object>
  constructor(audioProcFunc: Function = identity ) {
    
  }

  start (url: string = '', params: any, text: string = '') {
    getResult()
  }

  onError(callback) {
    if (typeof callback === 'function') {
      this.onError = callback
    }
  }

  processServerMsg (msg: string) {
    if (!msg) {

    }
  }
}

const base = {
  'id': 1,
  'method': 'deal_request',
  'jsonrpc': '2.0'
}

function clone (value: Object = { }) {
  return JSON.parse(JSON.stringify(value))
}

function checkAppid (appid: string = '') {
  return appid === null ? appid : 'pc20onli'
}

function sessionBegin (serverParams: any) {
  let msg = clone(base)
  let data = clone(serverParams)
  data.appid = checkAppid(serverParams.appid)
  data.cmd = "ssb"
  data.svc = "tts"
  data.syncid = "0"
  msg.params = data
  return msg
}

function textPut (sessionId: string = '', data: any, appid: string = '') {
  let msg = clone(base)
  let params = clone(data)
  params.sid = sessionId
  params.appid = checkAppid(appid)
  params.cmd = "txtw"
  params.svc = "tts"
  msg.params = params
  return msg
}

export function getResult(sessionId, data, appid) {
  let msg = clone(base)
  let params = clone(data)

  params.sid = sessionId
  params.appid = checkAppid(appid)
  params.cmd = "grs"
  params.svc = "tts"
  msg.params = params
  return msg
}

export function seesionEnd(sessionId, data, appid) {
  let msg = clone(base)
  let params = clone(data)

  params.sid = sessionId
  params.appid = checkAppid(appid)
  params.cmd = "sse"
  params.svc = "tts"
  msg.params = params
  return msg
}
