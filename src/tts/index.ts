/*!
 * ai_plus_sdk | bqliu hxli
 *
 * @todo
 *  - [ ] Error 处理
 *  - [ ] 类型提取至类型模块
 *  - [ ] net/http 类型优化
 *  - [ ] rpcParam 入参构造优化
 */
import { Base64 }  from 'js-base64'
import http, { TTS_RPCResponse, RPCResponse, SSB_RPCResponse, GRS_RPCResponse } from '../shared/net/http'

enum TTSStatus {
  idle = 'idle',        // 空闲
  sessionBegin = 'ssb', // 会话开始
  textWrite = 'txtw',   // 写入文本
  getResult = 'grs',    // 获取结果
  sessionEnd = 'sse'    // 会话结束
}

interface IRPCMessage<T> {
  id: number;
  jsonrpc: string;
  method: string;
  params: T
}

// extends SSB_RPCParam | TXTW_RPCParam | GRS_RPCParam | SSE_RPCParam
interface RPCMessage<T> extends IRPCMessage<T> {
  id: 1;
  jsonrpc: '2.0';
  method: 'deal_request',
  params: T
}

interface BaseRPCParam {
  appid: string;
  cmd: TTSStatus;
  extend_params: string;
  sid: string;
  svc: string;
  syncid: string;
}

type SSB_RPCParam = BaseRPCParam & SSB_RPCParam_SP

interface SSB_RPCParam_SP {
  aue: string;
  auf: string;
  auth_id: string;
  bgs: number;
  engine_name: string;
  pit: number;
  ram: number;
  spd: number;
  vid: string,
  vol: number;
}

type TXTW_RPCParam = BaseRPCParam & {
  data: string;
}

type GRS_RPCParam = BaseRPCParam

type SSE_RPCParam = BaseRPCParam & {
  auth_id: string;
}

type TTS_RPCParam = SSB_RPCParam | TXTW_RPCParam | GRS_RPCParam | SSE_RPCParam

export type TTSOption = SSB_RPCParam_SP & Pick<BaseRPCParam, 'extend_params'> & Pick<BaseRPCParam, 'appid'>

interface StartOption {
  url: string;
  text: string;
  apiMethod?: string;
  ttsOption: TTSOption;
}

interface TTSPayload {
  sid?: string;
  svc: string;
  syncid: string;
}

function genRPCMessage<T extends TTS_RPCParam> (rpcParam: T): RPCMessage<T> {
  return {
    id: 1,
    jsonrpc: '2.0',
    method: 'deal_request',
    params: rpcParam
  }
}

export default class TTS {
  public status: TTSStatus = TTSStatus.idle;
  processPCMBase64Data: Function

  constructor (fn: Function) {
    this.processPCMBase64Data = fn
  }

  start (startOption: StartOption) {
    if (this.status !== TTSStatus.idle) {
      return
    }
    const initialSyncId = -1
    this.status = TTSStatus.sessionBegin

    const rpcParam = startOption.ttsOption as SSB_RPCParam
    rpcParam.cmd = this.status
    
    const ttsPayload = {
      svc: 'tts',
      syncid: initialSyncId.toString()
    }

    rpcParam.svc = ttsPayload.svc

    this.getData(rpcParam, startOption, ttsPayload)
  }

  end (startOption: StartOption, ttsPayload: TTSPayload) {
    if   (this.status === TTSStatus.sessionEnd || this.status === TTSStatus.idle) {
      return
    }
    this.status = TTSStatus.sessionEnd
    const { appid, extend_params } = startOption.ttsOption
    const rpcParam: SSE_RPCParam = {
      auth_id: startOption.ttsOption.auth_id,
      appid,
      extend_params,
      cmd: this.status,
      sid: ttsPayload.sid as string,
      syncid: ttsPayload.syncid,
      svc: ttsPayload.svc
    }
    this.getData(rpcParam, startOption, ttsPayload).catch(() => {
      this.status === TTSStatus.idle
    })
  }

  onError (error: string = '') {
    console.log(error)
  }

  processResponse (rpcResponse: TTS_RPCResponse | void, startOption: StartOption, ttsPayload: TTSPayload) {
    if (!rpcResponse) {
      this.onError()
      return
    }
    if (rpcResponse.ret !== 0) {
      this.onError('数据有误')
      return
    }
    if (this.status === TTSStatus.sessionBegin) {
      ttsPayload.sid = (rpcResponse as SSB_RPCResponse).sid
      this.status = TTSStatus.textWrite
      const { appid, extend_params } = startOption.ttsOption
      const rpcParam: TXTW_RPCParam = {
        appid,
        extend_params,
        cmd: this.status,
        sid: ttsPayload.sid,
        syncid: ttsPayload.syncid,
        svc: ttsPayload.svc,
        data: Base64.encode(startOption.text)
      }
      this.getData(rpcParam, startOption, ttsPayload)
      return
    }
    if (this.status === TTSStatus.textWrite) {
      this.status = TTSStatus.getResult
      const { appid, extend_params } = startOption.ttsOption
      const rpcParam: GRS_RPCParam = {
        appid,
        extend_params,
        cmd: this.status,
        sid: ttsPayload.sid as string,
        syncid: ttsPayload.syncid,
        svc: ttsPayload.svc
      }
      this.getData(rpcParam, startOption, ttsPayload)
      return
    }
    if (this.status === TTSStatus.getResult) {
      const response = rpcResponse as GRS_RPCResponse
      if (response.data) {
        this.processPCMBase64Data(response.data)
      }
      if (response.ttsStatus === 0) {
        this.end(startOption, ttsPayload)
        return
      }
      const { appid, extend_params } = startOption.ttsOption
      const rpcParam: GRS_RPCParam = {
        appid,
        extend_params,
        cmd: this.status,
        sid: ttsPayload.sid as string,
        syncid: ttsPayload.syncid,
        svc: ttsPayload.svc
      }
      this.getData(rpcParam, startOption, ttsPayload)
    }
    if (this.status === TTSStatus.sessionEnd) {
      this.status = TTSStatus.idle
    }
  }

  getData (rpcParam: TTS_RPCParam, option: StartOption, ttsPayload: TTSPayload) {
    ttsPayload.syncid = (+ttsPayload.syncid + 1).toString()
    const rpcMessage = genRPCMessage(rpcParam)

    return http<RPCResponse<TTS_RPCResponse>>(option.url, option.apiMethod, JSON.stringify(rpcMessage)).then((data) => {
      this.processResponse(data.result, option, ttsPayload)
      console.log(data.result)
      return data.result
    }).catch((err) => {
      this.onError(err)
      throw err
    })
  }
}
