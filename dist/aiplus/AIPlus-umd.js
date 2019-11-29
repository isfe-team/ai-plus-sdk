(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('js-base64')) :
  typeof define === 'function' && define.amd ? define(['exports', 'js-base64'], factory) :
  (global = global || self, factory(global.AIPlus = {}, global.jsBase64));
}(this, (function (exports, jsBase64) { 'use strict';

  /*!
   * error | bqliu
   */
  (function (Error) {
      Error["RESPONSE_ERROR"] = "RESPONSE_ERROR";
      Error["NO_RESPONSE"] = "NO_RESPONSE";
  })(exports.Error || (exports.Error = {}));
  function genError(type, error) {
      return {
          AISdkError: true,
          type: type,
          error: error
      };
  }
  function isAISdkError(error) {
      return error.AISdkError === true;
  }
  //# sourceMappingURL=error.js.map

  /*! *****************************************************************************
  Copyright (c) Microsoft Corporation. All rights reserved.
  Licensed under the Apache License, Version 2.0 (the "License"); you may not use
  this file except in compliance with the License. You may obtain a copy of the
  License at http://www.apache.org/licenses/LICENSE-2.0

  THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
  WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
  MERCHANTABLITY OR NON-INFRINGEMENT.

  See the Apache Version 2.0 License for specific language governing permissions
  and limitations under the License.
  ***************************************************************************** */

  var __assign = function() {
      __assign = Object.assign || function __assign(t) {
          for (var s, i = 1, n = arguments.length; i < n; i++) {
              s = arguments[i];
              for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
          }
          return t;
      };
      return __assign.apply(this, arguments);
  };

  /*!
   * http | bqliu hxli
   *
   * a simple http client, just support the current demands, not a complete http client.
   */
  var defaultTimeout = 5 * 1000;
  function http(_a) {
      var _b = _a === void 0 ? {} : _a, _c = _b.url, url = _c === void 0 ? '' : _c, _d = _b.method, method = _d === void 0 ? 'post' : _d, _e = _b.param, param = _e === void 0 ? '' : _e, _f = _b.timeout, timeout = _f === void 0 ? defaultTimeout : _f;
      return new Promise(function (resolve, reject) {
          method = method.toUpperCase();
          var xhr = new XMLHttpRequest();
          xhr.open(method, url, true);
          xhr.timeout = timeout;
          xhr.setRequestHeader('Content-Type', 'application/json-rpc');
          xhr.send(param);
          xhr.addEventListener('readystatechange', function () {
              if (xhr.readyState !== xhr.DONE) {
                  return;
              }
              var status = xhr.status;
              if ((status >= 200 && status < 300) || status === 304) {
                  try {
                      var ret = JSON.parse(jsBase64.Base64.atob(xhr.responseText));
                      resolve(ret);
                  }
                  catch (e) {
                      reject(e);
                  }
                  return;
              }
              reject(xhr);
          });
      });
  }
  //# sourceMappingURL=http.js.map

  /*!
   * types | bqliu hxli
   */
  (function (TTSStatus) {
      TTSStatus["idle"] = "idle";
      TTSStatus["sessionBegin"] = "ssb";
      TTSStatus["textWrite"] = "txtw";
      TTSStatus["getResult"] = "grs";
      TTSStatus["sessionEnd"] = "sse"; // 会话结束
  })(exports.TTSStatus || (exports.TTSStatus = {}));
  //# sourceMappingURL=types.js.map

  /*!
   * tts of ai plus sdk | bqliu hxli
   */
  function genRPCMessage(rpcParam) {
      return {
          id: 1,
          jsonrpc: '2.0',
          method: 'deal_request',
          params: rpcParam
      };
  }
  var dummyResolvedPromise = Promise.resolve();
  // interact -> process -> interact -> process -> interact -> process -> interact
  // ssb error -> sse
  // ssb -> process error -> sse
  // ssb -> process -> txtw error -> sse
  // ssb -> process -> txtw -> process -> grs -> process -> grs -> process -> sse
  // ssb -> process -> txtw -> process -> grs -> process -> grs -> process -> sse error -> 
  var TTS = /** @class */ (function () {
      function TTS(status, processPCMBase64Data, onError) {
          if (status === void 0) { status = exports.TTSStatus.idle; }
          this.status = status;
          this.processPCMBase64Data = processPCMBase64Data;
          this.onError = onError;
          // only assignment
      }
      TTS.prototype.start = function (startOption) {
          var _this = this;
          if (this.status !== exports.TTSStatus.idle) {
              return;
          }
          var initialSyncId = '-1';
          this.status = exports.TTSStatus.sessionBegin;
          var ttsPayload = {
              svc: 'tts',
              syncid: initialSyncId
          };
          var rpcParam = __assign(__assign({}, startOption.ttsOption), { cmd: this.status, svc: ttsPayload.svc, syncid: ttsPayload.syncid });
          // user can invoke `end`
          this.end = this._end.bind(this, startOption, ttsPayload);
          return this.interact(rpcParam, startOption, ttsPayload)
              .catch(function (err) {
              var error = genError(exports.Error.NO_RESPONSE, err);
              _this.onErrorAdaptor(error);
              if (_this.status !== exports.TTSStatus.sessionEnd && _this.status !== exports.TTSStatus.idle) {
                  return _this._end(startOption, ttsPayload);
              }
              throw error;
          });
      };
      TTS.prototype._end = function (startOption, ttsPayload) {
          var _this = this;
          if (this.status === exports.TTSStatus.sessionEnd || this.status === exports.TTSStatus.idle) {
              return dummyResolvedPromise;
          }
          this.status = exports.TTSStatus.sessionEnd;
          var _a = startOption.ttsOption, appid = _a.appid, extend_params = _a.extend_params;
          var rpcParam = {
              auth_id: startOption.ttsOption.auth_id,
              appid: appid,
              extend_params: extend_params,
              cmd: this.status,
              sid: ttsPayload.sid,
              syncid: ttsPayload.syncid,
              svc: ttsPayload.svc
          };
          return this.interact(rpcParam, startOption, ttsPayload).catch(function (err) {
              _this.status === exports.TTSStatus.idle;
              throw err;
          });
      };
      TTS.prototype.onErrorAdaptor = function (error) {
          if (this.onError) {
              this.onError(error);
          }
      };
      TTS.prototype.processResponse = function (rpcResponseWrapper, startOption, ttsPayload) {
          var rpcResponse = rpcResponseWrapper.result;
          if (!rpcResponse) {
              var error = genError(exports.Error.NO_RESPONSE, rpcResponseWrapper);
              this.onErrorAdaptor(error);
              return Promise.reject(error);
          }
          if (rpcResponse.ret !== 0) {
              var error = genError(exports.Error.RESPONSE_ERROR, rpcResponseWrapper);
              this.onErrorAdaptor(error);
              return Promise.reject(error);
          }
          var _a = startOption.ttsOption, appid = _a.appid, extend_params = _a.extend_params;
          var basicParam = {
              appid: appid,
              extend_params: extend_params,
              cmd: this.status,
              sid: ttsPayload.sid || '',
              syncid: ttsPayload.syncid,
              svc: ttsPayload.svc
          };
          if (this.status === exports.TTSStatus.sessionBegin) {
              ttsPayload.sid = rpcResponse.sid;
              this.status = exports.TTSStatus.textWrite;
              var rpcParam = __assign(__assign({}, basicParam), { data: jsBase64.Base64.encode(startOption.text) });
              return this.interact(rpcParam, startOption, ttsPayload);
          }
          if (this.status === exports.TTSStatus.textWrite) {
              this.status = exports.TTSStatus.getResult;
              var rpcParam = basicParam;
              return this.interact(rpcParam, startOption, ttsPayload);
          }
          if (this.status === exports.TTSStatus.getResult) {
              var response = rpcResponse;
              if (response.data) {
                  this.processPCMBase64Data(response.data);
              }
              if (response.ttsStatus === 0) {
                  // or `this.end()`
                  return this._end(startOption, ttsPayload);
              }
              var rpcParam = basicParam;
              return this.interact(rpcParam, startOption, ttsPayload);
          }
          if (this.status === exports.TTSStatus.sessionEnd) {
              this.status = exports.TTSStatus.idle;
              return dummyResolvedPromise;
          }
          return dummyResolvedPromise;
      };
      TTS.prototype.interact = function (rpcParam, option, ttsPayload) {
          var _this = this;
          // syncid ++
          ttsPayload.syncid = (+ttsPayload.syncid + 1).toString();
          var rpcMessage = genRPCMessage(rpcParam);
          return http({
              url: option.url,
              method: option.apiMethod,
              param: JSON.stringify(rpcMessage)
          }).then(function (data) {
              return _this.processResponse(data, option, ttsPayload);
          });
      };
      return TTS;
  }());
  //# sourceMappingURL=index.js.map

  exports.default = TTS;
  exports.genError = genError;
  exports.isAISdkError = isAISdkError;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=AIPlus-umd.js.map
