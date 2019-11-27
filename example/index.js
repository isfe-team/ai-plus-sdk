import httpNet from './api.js'
const ttsStatus = {
  'idle': 'idle', //空闲
  'sessionBegin': 'ssb', //session begin 会话开始
  'textWrite': 'txtw', //text put 写入文本
  'getResult': 'grs', //get result 获取结果
  'sessionEnd': 'sse' //session end 会话结束
}

// 公共参数
const commonParam = {
  id: 1,
  jsonrpc: '2.0',
  method: 'deal_request',
  params: {
    svc: 'tts',
  }
}

function cloneDeep (data) {
  return JSON.parse(JSON.stringify(data))
}

export default class Tts {
  constructor () {
    this.syncid = 0
    this.status = null
    this.extendParams = null
    this.text = null
    this.serverParams = null
    this.sessionId = null
  }

  // 初始化tts, 进行sessionBegin操作
  initTts (url, params, text) {
    this.text = text
    this.serverParams = params
    this.extendParams = params.extend_params
    this.url = url
    this.start()
  }
  
  start () {
    this.syncid = 0
    this.status = ttsStatus.sessionBegin
    let data = cloneDeep(commonParam)
    data.params = Object.assign({ }, data.params, this.serverParams)
    data.params.cmd = this.status
    data.params.syncid = this.syncid.toString()
    this.syncid ++
    this.getData(data)
  }

  // 获取tts各个阶段请求的参数
  transApiData (data = { }) {
    const msg = cloneDeep(commonParam)
    data.sid = this.sessionId
    data.appid = this.appid
    data.cmd = this.status
    data.syncid = this.syncid.toString()
    data.extend_params = this.extendParams
    msg.params = Object.assign({ }, msg.params, data)
    return msg
  }

  detailData (callback) {
    this.detailData = callback
  }


  end () {
    if (!this.status || this.status === ttsStatus.sessionEnd || this.status === ttsStatus.idle) {
      return
    }
    const data = { auth_id: this.serverParams.auth_id }
    this.status = ttsStatus.sessionEnd
    const sseData = this.transApiData(data)
    this.getData(sseData)
  }

  onError (error) {
    console.log(error)
  }

  processResponse (data) {
    if (!data) {
      this.onError()
      return
    }
    this.syncid ++
    const transData = JSON.parse(atob(data))
    if (!transData.result || transData.result.ret !== 0) {
      this.onError('数据有误')
      return
    }
    if (this.status === ttsStatus.sessionBegin) {
      this.sessionId = transData.result.sid
      this.status = ttsStatus.textWrite
      const data = { data: btoa(this.text) }
      const txtwData = this.transApiData(data)
      this.getData(txtwData)
      return
    }
    if (this.status === ttsStatus.textWrite) {
      this.status = ttsStatus.getResult
      const grsData = this.transApiData()
      this.getData(grsData)
      return
    }
    if (this.status === ttsStatus.getResult) {
      if (transData.result.data) {
        this.detailData(transData.result.data)
      }
      if (transData.result.ttsStatus !== 0) {
        const grsData = this.transApiData()
        this.getData(grsData)
      } else {
        this.end()
      }
      return
    }
    if (this.status === ttsStatus.sessionEnd) {
      this.Status = ttsStatus.idle
    }
  }

  getData (data, method = 'post') {
    httpNet(method, this.url, JSON.stringify(data), (err, data) => {
      if (!err) {
        this.processResponse(data)
      } else {
        this.onError('GET_DATA_FAIL')
      }
    })
  }
}

