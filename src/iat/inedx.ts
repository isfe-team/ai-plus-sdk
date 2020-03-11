import { Base64 }  from 'js-base64'
import wsHttp from '../shared/net/wsHttp'
import audioCtxt from './audioHandle'
import { IATStatus, SSBParamType, SSBOnlyParamType, IAT_RPCParam, BaseParam, BaseRPCParam, ParamResponse, IATResponse, SSB_Response, AUWParamType, AUW_Response, GRSParamType, GRS_Response, SSEParamType } from './type'
import { genError, Error } from '../shared/helpers/error';

type iatParam = SSBOnlyParamType & Pick<BaseRPCParam, 'appid'> & Pick<BaseRPCParam, 'uid'> & Pick<BaseRPCParam, 'type'>
export interface StartOption {
  url: string;
  isSpeex: Boolean;
  iatParam: iatParam;
}

interface IatPayload {
  sid?: any;
  svc: string;
  synid: string;
  audioStatus: string; // 音频状态 2表示未完成
  audiolen: string;
  audioData: string;
  frameCnt: number;
  frameSend: number;
  recorderBuffer: Array<ArrayBuffer>;
}

function genRPCMessage<T extends IAT_RPCParam> (rpcParam: T): BaseParam<T> {
  return {
    id: 1,
    jsonrpc: '2.0',
    method: 'request',
    params: rpcParam
  }
}

interface IatCallbacks {
  onStart?: Function
  onEnd?: Function
  onMessage?: Function
  onError?: Function
}

function identity (value?: any) {
  return value
}

// 整体流程
// 1. 初始化websocket
// 2. ws onopen -> 发送ssb请求
// 3. 收到应答(cmd = ssb)获取sid,开始录音
// 4. 收集音频 通过websocket发送auw 发送音频 如果未结束 缓冲6组发送 audiostatu:2 代表未结束 若结束 发送缓冲区数据，发送结尾数据 audiostatus:4代表结束
// 5. 收到应答(cmd = grs)，发起获取结果指令
// 6. 收到结果应答，当recStatus为5时发送会话结束指令，结束会话

export default class Iat {
  public status: IATStatus
  audioCtxt: audioCtxt | null
  ws: wsHttp
  onStart: Function
  onMessage: Function
  onError: Function
  onEnd: Function
  constructor (
    iatCallbacks: IatCallbacks
  ) {
    this.status = IATStatus.idle
    this.audioCtxt = null
    this.ws = new wsHttp()
    this.onStart = iatCallbacks.onStart || identity
    this.onEnd = iatCallbacks.onEnd || identity
    this.onMessage = iatCallbacks.onMessage || identity
    this.onError = iatCallbacks.onError || identity
  }

  start(startOption: StartOption) {
    this.status = IATStatus.sessionBegin
    const iatPayload = {
      svc: 'iat',
      sid: '0',
      synid: '0',
      audioStatus: '1',
      audiolen: '0',
      audioData: '',
      frameCnt: 0,
      frameSend: 6,
      recorderBuffer: []
    }
    // 初始话websocket
    const wsCallback = {
      onOpen: () => {
        this.sendWSApi(startOption, iatPayload, IATStatus.sessionBegin)
      },
      onMessage: (obj: any) => {
        try {
          const ret = JSON.parse(obj.data)
          this.processServerMsg.call(this, ret, startOption, iatPayload)
        } catch (ex) { }
      },
      onClose: () => {
        this.end(startOption, iatPayload)
      },
      onError: (error: any) => {
        const errors = genError(Error.NO_RESPONSE, error)
        this.onError(errors)
      }
    }
    this.ws.disconnect()
    this.ws.connect(startOption.url, wsCallback)
    this.getResult.bind(this, startOption, iatPayload)
    if (this.audioCtxt) {
      this.audioCtxt.stop()
    } else {
      // 启动麦克风
      this.audioCtxt = new audioCtxt(true, true, { onAudioChunk: this.onAudioChunk.bind(this, ...arguments, startOption,  iatPayload)})
    }
  }

  // 针对不同的阶段发送不同的请求
  private sendWSApi (startOption: StartOption, iatPayload: IatPayload, type: string) {
    // SSB
    if (type === IATStatus.sessionBegin) {
      const rpcParam: SSBParamType = {
        ...startOption.iatParam,
        cmd: this.status,
        svc: iatPayload.svc
      }
      this.ws.send(genRPCMessage(rpcParam))
      return
    }
    // AUW
    if (type === IATStatus.audioWrite) {
      if (iatPayload.recorderBuffer.length === 0) {
        return
      }
      const frameSize = 43 // 帧长 43bit
      const audioLength = iatPayload.recorderBuffer.length * frameSize
      let str = ''
      var output = iatPayload.recorderBuffer.splice(0, iatPayload.recorderBuffer.length)
      var outputArray = new Int8Array(audioLength)
      var view
      for (let i = 0; i < output.length; i++) {
        view = new Int8Array(output[i])
        outputArray.set(view, i * frameSize)
      }
      for (let i = 0; i < audioLength; i++) {
        str = str +  String.fromCharCode(outputArray[i])
      }
      iatPayload.audioData = Base64.btoa(str)
      iatPayload.audiolen = '' + audioLength;
      (+iatPayload.synid + 1).toString()
      const audioStatus = iatPayload.audioStatus
      if (iatPayload.audioStatus === '1') {
        iatPayload.audioStatus = '2'
      }
      const rpcParam: AUWParamType = {
        sid: iatPayload.sid,
        svc: iatPayload.svc,
        synid: iatPayload.synid,
        appid: startOption.iatParam.appid,
        cmd: this.status,
        audioStatus: audioStatus,
        audiolen: iatPayload.audiolen,
        data: iatPayload.audioData,
        uid: startOption.iatParam.uid
      }
      this.ws.send(genRPCMessage(rpcParam))
      return
    }
    // GRS
    if (type === IATStatus.getResult) {
      const rpcParam: GRSParamType = {
        appid: startOption.iatParam.appid,
        cmd: this.status,
        sid: iatPayload.sid,
        svc: iatPayload.svc,
        uid: startOption.iatParam.uid,
        type: startOption.iatParam.type
      }
      this.ws.send(genRPCMessage(rpcParam))
      return
    }
    // SSE
    if (type === IATStatus.sessionEnd) {
      const rpcParam: SSEParamType = {
        appid: startOption.iatParam.appid,
        cmd: this.status,
        sid: iatPayload.sid,
        svc: iatPayload.svc,
        uid: startOption.iatParam.uid,
        type: startOption.iatParam.type
      }
      this.ws.send(genRPCMessage(rpcParam))
    }
  }

  onAudioChunk(data: any, startOption: StartOption, iatPayload: IatPayload) {
    if (this.status === IATStatus.getResult || iatPayload.sid == null) {
      return
    }
    this.status = IATStatus.audioWrite
    if (iatPayload.frameCnt >= iatPayload.frameSend) {
      this.sendWSApi(startOption, iatPayload, IATStatus.audioWrite)
      iatPayload.frameCnt = 0
    }
    iatPayload.recorderBuffer.push(new Uint8Array(data.buffer))
    iatPayload.frameCnt = iatPayload.frameCnt + 1
  }

  end (startOption: StartOption, iatPayload: IatPayload) {
    this.audioCtxt ? this.audioCtxt.stop() : ''
    this.status = IATStatus.sessionEnd
    if (this.status === IATStatus.sessionEnd && iatPayload.sid != null) {
      this.sendWSApi(startOption, iatPayload, IATStatus.sessionEnd)
    }
    this.status = IATStatus.idle
  }

  getResult (startOption: StartOption, iatPayload: IatPayload) {
    this.audioCtxt ? this.audioCtxt.stop() : ''
    if (this.status === IATStatus.audioWrite) {
      this.sendWSApi(startOption, iatPayload, IATStatus.audioWrite)
      // 然后执行录音发送完毕信号
      iatPayload.frameCnt = 0
      iatPayload.audioData = ''
      iatPayload.audiolen = '0'
      iatPayload.audioStatus = '4'
      this.sendWSApi(startOption, iatPayload, IATStatus.audioWrite)
      iatPayload.synid = '0'
      iatPayload.audioStatus = '1'
      iatPayload.recorderBuffer = []
      this.status = IATStatus.getResult
    }
    if (this.status === IATStatus.getResult) {
      this.sendWSApi(startOption, iatPayload, IATStatus.getResult)
    } else {
      this.end(startOption, iatPayload)
    }
  }

  private processServerMsg (
    rpcResponseWrapper: ParamResponse<IATResponse>,
    StartOption: StartOption,
    iatPayload: IatPayload
  ) {
    const { result: rpcResponse } = rpcResponseWrapper
    if (!rpcResponse) {
      const error = genError(Error.NO_RESPONSE, rpcResponseWrapper)
      this.onError(error)
      return
    }
    const { cmd, ret } = rpcResponse
    if (ret !== 0) {
      this.end(StartOption, iatPayload)
      const error = genError(Error.RESPONSE_ERROR, rpcResponseWrapper)
      this.onError(error)
      return
    }
    if (cmd === IATStatus.sessionBegin) {
      iatPayload.sid = (rpcResponse as SSB_Response).sid
      // 开始录音操作
      this.audioCtxt ? this.audioCtxt.start() : identity()
      // 用户在此时可以进行开始操作
      this.onStart()
      return
    }
    if (cmd === IATStatus.audioWrite) {
      const recStatus = (rpcResponse as AUW_Response).recStatus
      const iatrst = (rpcResponse as AUW_Response).iatrst
      const iatpgs = (rpcResponse as AUW_Response).pgs
      // 表示此时还没有结束，可以输入识别内容
      if (recStatus === 0) {
        this.onMessage({ end: false, pgs: iatpgs, result: iatrst })
        return
      }
      if (recStatus === 5) {
        this.onMessage({ end: true, pgs: iatpgs, result: iatrst })
        this.end(StartOption, iatPayload)
      }
      return
    }
    if (cmd === IATStatus.getResult) {
      if (this.status !== IATStatus.getResult) {
        const error = genError(Error.RESPONSE_ERROR, rpcResponseWrapper)
        this.onError(error)
        return
      }
      const resultStatus = (rpcResponse as GRS_Response).resultStatus
      const iatrst = (rpcResponse as GRS_Response).iatrst
      const iatpgs = (rpcResponse as GRS_Response).pgs
      if (resultStatus === 5) {
        this.end(StartOption, iatPayload)
        this.onMessage({end: true, pgs: iatpgs, result: iatrst})
        return
      }
      this.getResult(StartOption, iatPayload)
      this.onMessage({end: false, pgs: iatpgs, result: iatrst})
      return
    }
    if (cmd === IATStatus.sessionEnd) {
      iatPayload.sid = null
      this.onEnd()
      return
    }
    const error = genError(Error.RESPONSE_ERROR, rpcResponse.ret)
    this.onError(error)
  }
}
