export enum IATStatus {
  idle = 'idle',         // 空闲
  sessionBegin = 'ssb',  // 会话开始
  audioWrite = 'auw',    // 写入音频
  getResult = 'grs',     // 获取结果
  sessionEnd = 'sse'     // 会话结束
}
  
interface BaseParamType<T> {
  jsonrpc: string;
  method: string;
  id: number;
  params: T;
}

export interface BaseParam<T> extends BaseParamType<T> {
  jsonrpc: '2.0';
  method: 'request';
  id: 1;
  params: T;
}

export interface BaseRPCParam {
  appid: string;
  cmd: IATStatus;
  svc: string;
  sid: string;
  uid: string;
  type: string;
}

export interface SSBOnlyParamType {
  acous: string;
  apr: string;
  aue: string;
  auf: string;
  dwa: string;
  ent: string;
  eos: string;
  lang: string;
  sname: string;
  svad: string;
  type: string;
  vad_rst: string;
}
export type SSBParamType = Omit<BaseRPCParam & SSBOnlyParamType, 'sid'>

interface AUWOnlyParamType {
  audioStatus: string;
  audiolen: string;
  data: string;
  synid: string;
}

export type AUWParamType = Omit<BaseRPCParam & AUWOnlyParamType, 'type'>

export type GRSParamType = BaseRPCParam & {type: string, uid: string}

export type SSEParamType = GRSParamType

export type IAT_RPCParam = SSBParamType | AUWParamType | GRSParamType | SSEParamType


// 返回结果类型定义
export interface ParamResponse<T extends IATResponse> extends ParamTypeResponse<T> {
  id: number;
  jsonrpc: '2.0';
  result?: T;
}

export interface ParamTypeResponse<T> {
  id: number;
  jsonrpc: string;
  result?: T;
}

export interface Base_Response {
  ret: number;
  cmd: IATStatus;
}

// ssb/auw/grs/sse response
export type SSB_Response = Base_Response & {
  sid: string;
}

export type AUW_Response = Base_Response & {
  recStatus: number;
  iatrst: string;
  pgs: string;
}

export type GRS_Response = Base_Response & {
  resultStatus: number;
  iatrst: string;
  pgs: number;
}

export type SSE_Response = Base_Response

export type IATResponse = SSB_Response | AUW_Response | GRS_Response | SSE_Response
