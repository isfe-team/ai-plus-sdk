import { genError, Error } from '../shared/helpers/error'
import { resampleWorker, speexWork } from './worker'

interface AudioHandlerCallback {
  onAudioChunk: Function
  onError?: Function
}

function identity (value?: any) {
  return value
}

export default class audioCtxt {
  speexWorker: Worker
  resampleWorker: Worker
  recordStatus: Boolean
  isSpeex: Boolean
  isResample: Boolean
  onAudioChunk: Function
  onError: Function
  constructor (
    isSpeex: Boolean,
    isResample: Boolean,
    AudioHandlerCallback: AudioHandlerCallback,
  ) {
    this.isResample = isResample || true
    this.isSpeex = isSpeex || true
    this.speexWorker = new Worker(speexWork())
    this.resampleWorker = new Worker(resampleWorker())
    this.recordStatus = false
    this.onAudioChunk = AudioHandlerCallback.onAudioChunk
    this.onError = AudioHandlerCallback.onError || identity
  }

  start() {
    this.recordStatus = true
    this.resampleWorker.postMessage({
      command: 'init',
      config: {
        sampleRate: 4800,
        outputBufferLength: 0
      }
    })
    this.speexWorker.postMessage({ command: 'init' })
    this.manage()
  }

  // 录音阶段，有输入音频就返回输入音频，反之进行录音
  record (callback: Function) {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => { // 获取麦克风音频流
        const context = new AudioContext()  // 创建音频上下文
        let audioSource = context.createMediaStreamSource(stream) // 创建节点
        let audioScriptNode = context.createScriptProcessor(0, 1, 1) // 用于使用js直接操作音频数据 buffer暂时取0，选取该环境最适合的缓冲区大小
        audioSource.connect(audioScriptNode) // 将音频流输出到jsnode中
        audioScriptNode.connect(context.destination) // 将音频流输出到扬声器
          // 满足分片的buffer时触发
        audioScriptNode.onaudioprocess = (e) => {
          // 如果处于录音状态，继续传递录到的音频，反之断开AudioContext连接
          if (this.recordStatus) {
            callback(e.inputBuffer.getChannelData(0))
          } else {
            // 断开AudioContext连接
            audioSource.disconnect()
            audioScriptNode.disconnect()
          }
        }
      }).catch((error) => {
        const newError = genError(Error.NO_RESPONSE, error.message)
        this.onErrorAdaptor(newError)
      })
    } else {
      const error = genError(Error.NOT_SUPPORTED_TYPE, 'navigator.mediaDevices is not supported')
      this.onErrorAdaptor(error)
    }
  }

   // 重采样阶段
   useResampleWorker (buffer: ArrayBuffer) {
    this.resampleWorker.postMessage({
      command: 'record',
      buffer: buffer
    })
    this.resampleWorker.onmessage = (e: any) => {
      let buffer = e.data.buffer
      let data = new Int16Array(buffer)
      const result = new Int8Array(data.buffer)
      return Promise.resolve(result)
    }
    return Promise.reject(buffer)
  }

  // 音频压缩阶段
  useSpeexWorker (buffer: ArrayBuffer) {
    const output = new Int8Array([])
    const inData = new Int16Array(buffer)
    this.speexWorker.postMessage({
      command: 'encode',
      inData: inData,
      inOffset: 0,
      inCount: inData.length,
      outData: output,
      outOffset: 0
    })
    let result = new Int8Array([])
    this.speexWorker.onmessage = (e:any) => {
      if (e.data.command === 'encode') {
        let buffer = e.data.buffer
        result = new Int8Array(buffer)
      }
      return Promise.resolve(result)
    }
    return Promise.reject(buffer)
  }

  handleBuffer (buffer: ArrayBuffer) {
    if (this.isSpeex && !this.isResample) {
      return this.useSpeexWorker(buffer).then((buffer) => this.onAudioChunk(buffer))
    }
    if (this.isResample && !this.isSpeex) {
      return this.useResampleWorker(buffer).then((buffer) => this.onAudioChunk(buffer))
    }
    if (this.isSpeex && this.isResample) {
      return this.useResampleWorker(buffer).then((buffer) => this.useSpeexWorker(buffer)).then((buffer) => this.onAudioChunk(buffer))
    }
    return this.onAudioChunk(buffer)
  }

  manage () {
    this.record(this.handleBuffer)
  }

  private onErrorAdaptor (error: any) {
    if (this.onError) {
      this.onError(error)
    }
  }

  stop () {
    this.recordStatus = false
    // 终止所有的worker行为
    this.speexWorker.terminate()
    this.resampleWorker.terminate()
  }
}
