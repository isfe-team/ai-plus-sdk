/*!
 * tts of ai plus sdk | bqliu hxli
 *
 * @todo
 *  - [ ] `end` 后 start 的请求需要能 cancel，可以考虑基于 `Observable` 来设计
 */

import { Base64 }  from 'js-base64'
import http from '../shared/net/http'
import { SSB_RPCParam_SP, TTS_RPCParam, RPCMessage, TTSStatus, SSE_RPCParam, TXTW_RPCParam, GRS_RPCParam, BaseRPCParam, TTS_RPCResponse, SSB_RPCResponse, GRS_RPCResponse, RPCResponse, SSB_RPCParam } from './types';
import { genError, Error } from '../shared/helpers/error';

export * from './types'
export * from '../shared/helpers/error'

export type TTSOption = SSB_RPCParam_SP & Pick<BaseRPCParam, 'extend_params'> & Pick<BaseRPCParam, 'appid'>

export interface StartOption {
  url: string;
  text: string;
  apiMethod?: string;
  ttsOption: TTSOption;
}

export interface TTSPayload {
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

const dummyResolvedPromise = Promise.resolve()

// interact -> process -> interact -> process -> interact -> process -> interact
// ssb error -> sse
// ssb -> process error -> sse
// ssb -> process -> txtw error -> sse
// ssb -> process -> txtw -> process -> grs -> process -> grs -> process -> sse
// ssb -> process -> txtw -> process -> grs -> process -> grs -> process -> sse error -> 
export default class TTS {
  end!: (() => Promise<void | Promise<RPCResponse<TTS_RPCResponse>>>) | null;
  public status: TTSStatus;

  constructor (
    public processPCMBase64Data: Function,
    public onSuccess?: Function,
    public onError?: Function,
    public onComplete?: Function
  ) {
    this.status = TTSStatus.idle
  }

  start (startOption: StartOption) {
    if (this.status !== TTSStatus.idle) {
      return
    }
    const initialSyncId = '0'
    this.status = TTSStatus.sessionBegin

    const ttsPayload = {
      svc: 'tts',
      syncid: initialSyncId.toString()
    }

    const rpcParam: SSB_RPCParam = {
      ...startOption.ttsOption,
      cmd: this.status,
      svc: ttsPayload.svc,
      syncid: ttsPayload.syncid
    }

    // user can invoke `end`
    this.end = this._end.bind(this, startOption, ttsPayload)

    return this.interact(rpcParam, startOption, ttsPayload)
      .then(() => this.onSuccessAdaptor())
      .catch((err: any) => {
        const error = genError(Error.NO_RESPONSE, err)
        this.onErrorAdaptor(error)
        if (this.status !== TTSStatus.sessionEnd && this.status !== TTSStatus.idle) {
          return this._end(startOption, ttsPayload)
        }
        throw error
      })
      .finally(() => this.onCompleteAdaptor())
  }

  private _end (startOption: StartOption, ttsPayload: TTSPayload) {
    if (this.status === TTSStatus.sessionEnd || this.status === TTSStatus.idle) {
      return dummyResolvedPromise
    }
    this.status = TTSStatus.sessionEnd
    // if failed, sid is not exist
    if (!ttsPayload.sid) {
      return dummyResolvedPromise
    }
    const { appid, extend_params } = startOption.ttsOption
    const rpcParam: SSE_RPCParam = {
      auth_id: startOption.ttsOption.auth_id,
      appid,
      extend_params,
      cmd: this.status,
      sid: ttsPayload.sid,
      syncid: ttsPayload.syncid,
      svc: ttsPayload.svc
    }

    return this.interact(rpcParam, startOption, ttsPayload).catch((err) => {
      this.status = TTSStatus.idle
      throw err
    })
  }

  private onSuccessAdaptor () {
    if (this.onSuccess) {
      this.onSuccess()
    }
  }

  private onCompleteAdaptor () {
    if (this.onComplete) {
      this.onComplete()
    }
  }

  private onErrorAdaptor (error: any) {
    if (this.onError) {
      this.onError(error)
    }
  }

  private processResponse (
    rpcResponseWrapper: RPCResponse<TTS_RPCResponse>,
    startOption: StartOption,
    ttsPayload: TTSPayload
  ): Promise<void | Promise<RPCResponse<TTS_RPCResponse>>> {
    const { result: rpcResponse } = rpcResponseWrapper
    if (!rpcResponse) {
      const error = genError(Error.NO_RESPONSE, rpcResponseWrapper)
      this.onErrorAdaptor(error)
      return Promise.reject(error)
    }
    if (rpcResponse.ret !== 0) {
      const error = genError(Error.RESPONSE_ERROR, rpcResponseWrapper)
      this.onErrorAdaptor(error)
      return Promise.reject(error)
    }
    const { appid, extend_params } = startOption.ttsOption
    const basicParam = {
      appid,
      extend_params,
      sid: ttsPayload.sid || '',
      syncid: ttsPayload.syncid,
      svc: ttsPayload.svc
    }
    if (this.status === TTSStatus.sessionBegin) {
      ttsPayload.sid = (rpcResponse as SSB_RPCResponse).sid
      this.status = TTSStatus.textWrite
      const rpcParam: TXTW_RPCParam = {
        ...basicParam,
        cmd: this.status,
        sid: ttsPayload.sid,
        data: Base64.encode(startOption.text)
      }
      return this.interact(rpcParam, startOption, ttsPayload)
    }
    if (this.status === TTSStatus.textWrite) {
      this.status = TTSStatus.getResult
      const rpcParam: GRS_RPCParam = {
        ...basicParam,
        cmd: this.status
      }
      return this.interact(rpcParam, startOption, ttsPayload)
    }
    if (this.status === TTSStatus.getResult) {
      const response = rpcResponse as GRS_RPCResponse
      if (response.data) {
        this.processPCMBase64Data(response.data)
      }
      if (response.ttsStatus === 0) {
        // or `this.end()`
        return this._end(startOption, ttsPayload)
      }
      const rpcParam: GRS_RPCParam = {
        ...basicParam,
        cmd: this.status
      }
      return this.interact(rpcParam, startOption, ttsPayload)
    }
    if (this.status === TTSStatus.sessionEnd) {
      this.status = TTSStatus.idle
      return dummyResolvedPromise
    }
    return dummyResolvedPromise
  }

  interact (rpcParam: TTS_RPCParam, option: StartOption, ttsPayload: TTSPayload) {
    // syncid ++
    ttsPayload.syncid = (+ttsPayload.syncid + 1).toString()

    const rpcMessage = genRPCMessage(rpcParam)

    return http<RPCResponse<TTS_RPCResponse>>({
      url: option.url,
      method: option.apiMethod,
      param: JSON.stringify(rpcMessage)
    }).then((data) => {
      return this.processResponse(data, option, ttsPayload)
    })
  }
}

export function getResolvedPromise<T> (value?: T) {
  return Promise.resolve(value)
}

export function noop () { }
