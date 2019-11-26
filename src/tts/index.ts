const ttsStatus = {
  'idle': 'idle', //空闲
  'sessionBegin': 'ssb', //session begin 会话开始
  'textPut': 'txtw', //text put 写入文本
  'getResult': 'grs', //get result 获取结果
  'sessionEnd': 'sse' //session end 会话结束
}

const commonParam = {
  id: 1,
  jsonrpc: '2.0',
  method: 'deal_request',
  params: {
    svc: 'tts',
  }
}
