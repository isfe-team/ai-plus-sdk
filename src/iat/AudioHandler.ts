import { genError, Error } from '../shared/helpers/error'
import { resampleWorkerCode, speexWorkerCode } from './WorkerUtils'

interface AudioOption {
  isSpeex: Boolean
  isResample: Boolean
  onAudioChunk: Function
  onError?: Function
}

function identity<T> (value: T) {
  return value
}

export default class AudioHandler {
  private onAudioChunk: Function
  private onError: Function
  private speexWorker: Worker
  private resampleWorker: Worker
  private recordStatus: Boolean
  private isResample: Boolean
  private isSpeex: Boolean
  constructor (
    audioOption: AudioOption,
  ) {
    this.onAudioChunk = audioOption.onAudioChunk
    this.onError = audioOption.onError || identity
    this.speexWorker = speexWorkerCode()
    this.resampleWorker = resampleWorkerCode()
    this.recordStatus = false
    this.isResample = audioOption.isResample
    this.isSpeex = audioOption.isSpeex
  }

  start () {
    this.recordStatus = true
    this.resampleWorker.postMessage({
      command: 'init',
      config: {
        outputBufferLength: 0
      }
    })
    this.speexWorker.postMessage({ command: 'init' })
    this.manage()
  }

  // 录音阶段
  private record (callback: Function) {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => { // 获取麦克风音频流
        const context = new AudioContext()  // 创建音频上下文
        const audioSource = context.createMediaStreamSource(stream) // 创建节点
        const audioScriptNode = context.createScriptProcessor(0, 1, 1) // 用于使用js直接操作音频数据 buffer暂时取0，选取该环境最适合的缓冲区大小
        audioSource.connect(audioScriptNode) // 将音频流输出到jsnode中
        audioScriptNode.connect(context.destination) // 将音频流输出到扬声器
        // 满足分片的buffer时触发
        const audioProcess = (e: AudioProcessingEvent) => {
          // 如果处于录音状态，继续传递录到的音频，反之断开AudioContext连接
          if (this.recordStatus) {
            const result = new Float32Array(e.inputBuffer.getChannelData(0)).buffer
            callback(result, context.sampleRate)
          } else {
            // 断开AudioContext连接
            audioScriptNode.removeEventListener('audioprocess', audioProcess)
            audioSource.disconnect()
            audioScriptNode.disconnect()
          }
        }
        audioScriptNode.addEventListener('audioprocess', audioProcess)
      }).catch((error) => {
        const newError = genError(Error.NO_RESPONSE, error.message)
        this.onError(newError)
      })
    } else {
      const error = genError(Error.NOT_SUPPORTED_TYPE, 'navigator.mediaDevices is not supported')
      this.onError(error)
    }
  }

   // 重采样阶段
  private resample (buffer: ArrayBuffer, sampleRate: Number, callback: Function) {
    this.resampleWorker.postMessage({
      command: 'record',
      buffer: new Float64Array(buffer),
      sampleRate: sampleRate
    })
    this.resampleWorker.addEventListener('message', (e) => {
      const buffer = e.data.buffer
      const result = new Int16Array(buffer).buffer
      callback(result)
    })
  }

  // 音频压缩阶段
  private speex (buffer: ArrayBuffer) {
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
    this.speexWorker.addEventListener('message', (e) => {
      if (e.data.command === 'encode') {
        const buffer = e.data.buffer
        const result = new Int8Array(buffer)
        this.onAudioChunk(result.buffer)
      }
    })
  }

  private handleBuffer (buffer: ArrayBuffer, sampleRate: Number) {
    if (this.isSpeex && !this.isResample) {
      this.speex(buffer)
      return
    }
    if (this.isResample && !this.isSpeex) {
      this.resample(buffer, sampleRate, this.onAudioChunk.bind(this))
      return
    }
    if (this.isSpeex && this.isResample) {
      this.resample(buffer, sampleRate, this.speex.bind(this))
      return
    }
    this.onAudioChunk(buffer)
  }

  private manage () {
    this.record(this.handleBuffer.bind(this))
  }

  stop () {
    this.recordStatus = false
    // 终止所有的worker行为
    this.speexWorker.terminate()
    this.resampleWorker.terminate()
  }
}
