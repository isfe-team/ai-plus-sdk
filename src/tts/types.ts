/*!
 * types | bqliu hxli
 */

/** status of tts */
export enum TTSStatus {
  idle = 'idle',        // 空闲
  sessionBegin = 'ssb', // 会话开始
  textWrite = 'txtw',   // 写入文本
  getResult = 'grs',    // 获取结果
  sessionEnd = 'sse'    // 会话结束
}

/** rpc message rel */
// rpc message wrapper
export interface IRPCMessage<T> {
  id: number;
  jsonrpc: string;
  method: string;
  params: T
}

// rpc message with accurate info
// in fact, type `T` sholud be `extends SSB_RPCParam | TXTW_RPCParam | GRS_RPCParam | SSE_RPCParam`
export interface RPCMessage<T> extends IRPCMessage<T> {
  id: 1;
  jsonrpc: '2.0';
  method: 'deal_request',
  params: T
}

// basic rpc param, which will be included in all messages
export interface BaseRPCParam {
  appid: string;
  cmd: TTSStatus;
  extend_params: string;
  sid: string;
  svc: string;
  syncid: string;
}

// ssb/txtw/grs/sse params
export type SSB_RPCParam = Omit<BaseRPCParam & SSB_RPCParam_SP, 'sid'>

export interface SSB_RPCParam_SP {
  aue: string;
  auf: string;
  auth_id: string;
  bgs?: number;
  engine_name: string;
  pit?: number;
  ram?: number;
  spd?: number;
  vid: string;
  vol?: number;
}

export type TXTW_RPCParam = BaseRPCParam & {
  data: string;
}

export type GRS_RPCParam = BaseRPCParam

export type SSE_RPCParam = BaseRPCParam & {
  auth_id: string;
}

// union type
export type TTS_RPCParam = SSB_RPCParam | TXTW_RPCParam | GRS_RPCParam | SSE_RPCParam

/** rpc response rel */
// rpc response wrapper
export interface IRPCResponse<T> {
  id: number;
  jsonrpc: string;
  result?: T;
}

// rpc response with accurate info
export interface RPCResponse<T extends TTS_RPCResponse> extends IRPCResponse<T> {
  id: number;
  jsonrpc: '2.0';
  result?: T;
}

// basic rpc response structure
export interface Base_RPCResponse {
  ret: number;
}

// ssb/txtw/grs/sse response structure
export type SSB_RPCResponse = Base_RPCResponse & {
  sid: string;
}

type TXTW_RPCResponse = Base_RPCResponse

export type GRS_RPCResponse = Base_RPCResponse & {
  ttsStatus: number;
  data: string;
  [key: string]: any;
}

export type SSE_RPCResponse = Base_RPCResponse

// union
export type TTS_RPCResponse = SSB_RPCResponse | TXTW_RPCResponse | GRS_RPCResponse | SSE_RPCResponse
