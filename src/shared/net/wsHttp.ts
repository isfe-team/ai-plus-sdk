export interface callbackObject {
  onopen: Function
  onmessage: Function
  onerror: Function
  onclose: Function

}
export default class wsHttp {
  ws!: WebSocket | any
  constructor (url: string, callback: callbackObject) {
    this.ws = null
    if (this.ws === null || this.ws.readyState !== WebSocket.OPEN) {
      this.ws = new WebSocket(url)
      this.ws.onopen = callback.onopen
      this.ws.onmessage = callback.onmessage
      this.ws.onerror = callback.onerror
      this.ws.onclose = callback.onclose
    }
  }
  send (data: object) {
    if (this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      return
    }
    this.ws.send(JSON.stringify(data))
  }

  disconnect () {
    if (this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      return
    }
    this.ws.close()
  }
}
