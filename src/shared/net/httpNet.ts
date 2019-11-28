export default function api (method: string = 'POST', url: string, param: string, callback: Function) {
  method = method.toUpperCase()
  const xmlHttp = new XMLHttpRequest()
  xmlHttp.open(method, url, true)
  xmlHttp.timeout = 5 * 1000
  xmlHttp.setRequestHeader('Content-Type', 'application/json-rpc')
  xmlHttp.send(param)
  xmlHttp.onreadystatechange = function () {
    let ret = null
    try {
      ret = xmlHttp.responseText
    } catch (e) { }
    if (xmlHttp.readyState === 4) {
      if (xmlHttp.status >= 200 && xmlHttp.status < 300) {
        callback(null, ret)
      } else {
        if (xmlHttp.status === 500) {
          callback(new Error('系统异常'), ret)
          return
        }
        if (xmlHttp.status === 504) {
          callback(new Error('网络超时'), ret)
          return
        }
        callback(new Error('请求失败'), ret)
      }
    }
  }
}
