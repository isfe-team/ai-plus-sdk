interface WsCallback {
  onOpen: Function
  onMessage: Function
  onError: Function
  onClose: Function
  url: string
}

interface WebSocket {
  onopen: Function
  onmessage: Function
  onerror: Function
  onclose: Function
  send: Function
  readyState: Number
  close: Function
}
export default class wsHttp {
  ws!: WebSocket | null
  constructor () { }
  connect (wsCallback: WsCallback) {
    this.ws = null
    if (this.ws === null || (this.ws as WebSocket).readyState !== WebSocket.OPEN) {
      this.ws = new WebSocket(wsCallback.url) as WebSocket
      this.ws.onopen = wsCallback.onOpen
      this.ws.onmessage = wsCallback.onMessage
      this.ws.onerror = wsCallback.onError
      this.ws.onclose = wsCallback.onClose
    }
}
  send (data: object) {
    if ((this.ws as WebSocket).readyState === WebSocket.CLOSED || (this.ws as WebSocket).readyState === WebSocket.CLOSING) {
      return
    }
    (this.ws as WebSocket).send(JSON.stringify(data))
  }

  disconnect () {
    if ((this.ws as WebSocket).readyState === WebSocket.CLOSED || (this.ws as WebSocket).readyState === WebSocket.CLOSING) {
      return
    }
    (this.ws as WebSocket).close()
    this.ws = null
  }
}
