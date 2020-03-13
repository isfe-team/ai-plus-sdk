interface WsOption {
  url: string
  onOpen: Function
  onMessage: Function
  onError: Function
  onClose: Function
}

interface WebSocket {
  onopen: Function
  onmessage: Function
  onerror: Function
  onclose: Function
  send: Function
  close: Function
  readyState: Number
}
export default class WsWrapper {
  private ws: WebSocket | null
  constructor () {
    this.ws = null
  }
  connect (WsOption: WsOption) {
    if (this.ws === null || (this.ws as WebSocket).readyState !== WebSocket.OPEN) {
      this.ws = new WebSocket(WsOption.url) as WebSocket
      this.ws.onopen = WsOption.onOpen
      this.ws.onmessage = WsOption.onMessage
      this.ws.onerror = WsOption.onError
      this.ws.onclose = WsOption.onClose
    }
  }
  send<T = any>(data: T) {
    if ((this.ws as WebSocket).readyState === WebSocket.CLOSED || (this.ws as WebSocket).readyState === WebSocket.CLOSING) {
      return
    }
    (this.ws as WebSocket).send(data)
  }

  disconnect () {
    if ((this.ws as WebSocket).readyState === WebSocket.CLOSED || (this.ws as WebSocket).readyState === WebSocket.CLOSING) {
      return
    }
    (this.ws as WebSocket).close()
    this.ws = null
  }
}
