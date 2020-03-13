(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('@isfe/mse-player/src/MSEPlayer'), require('@isfe/mse-player/src/helpers/wavToMp3'), require('@isfe/mse-player/src/helpers/pcmToWav'), require('@isfe/mse-player/src/helpers/base64WithoutPrefixToBlob'), require('@isfe/mse-player/src/helpers/base64ToWavBlob'), require('lamejs'), require('js-base64')) :
  typeof define === 'function' && define.amd ? define(['@isfe/mse-player/src/MSEPlayer', '@isfe/mse-player/src/helpers/wavToMp3', '@isfe/mse-player/src/helpers/pcmToWav', '@isfe/mse-player/src/helpers/base64WithoutPrefixToBlob', '@isfe/mse-player/src/helpers/base64ToWavBlob', 'lamejs', 'js-base64'], factory) :
  (global = global || self, global.TTSWithPlayer = factory(global.MSEPlayer, global.wavToMp3, global.pcmToWav, global.base64WithoutPrefixToBlob, global.base64ToWavBlob, global.lamejs, global.jsBase64));
}(this, (function (MSEPlayer, wavToMp3, pcmToWav, base64WithoutPrefixToBlob, base64ToWavBlob, lamejs, jsBase64) { 'use strict';

  MSEPlayer = MSEPlayer && Object.prototype.hasOwnProperty.call(MSEPlayer, 'default') ? MSEPlayer['default'] : MSEPlayer;
  wavToMp3 = wavToMp3 && Object.prototype.hasOwnProperty.call(wavToMp3, 'default') ? wavToMp3['default'] : wavToMp3;
  pcmToWav = pcmToWav && Object.prototype.hasOwnProperty.call(pcmToWav, 'default') ? pcmToWav['default'] : pcmToWav;
  base64WithoutPrefixToBlob = base64WithoutPrefixToBlob && Object.prototype.hasOwnProperty.call(base64WithoutPrefixToBlob, 'default') ? base64WithoutPrefixToBlob['default'] : base64WithoutPrefixToBlob;
  base64ToWavBlob = base64ToWavBlob && Object.prototype.hasOwnProperty.call(base64ToWavBlob, 'default') ? base64ToWavBlob['default'] : base64ToWavBlob;
  lamejs = lamejs && Object.prototype.hasOwnProperty.call(lamejs, 'default') ? lamejs['default'] : lamejs;

  /*!
   * types | bqliu hxli
   */
  /** status of tts */
  var TTSStatus;
  (function (TTSStatus) {
      TTSStatus["idle"] = "idle";
      TTSStatus["sessionBegin"] = "ssb";
      TTSStatus["textWrite"] = "txtw";
      TTSStatus["getResult"] = "grs";
      TTSStatus["sessionEnd"] = "sse"; // 会话结束
  })(TTSStatus || (TTSStatus = {}));

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

  /*!
   * error | bqliu
   */
  var Error;
  (function (Error) {
      Error["RESPONSE_ERROR"] = "RESPONSE_ERROR";
      Error["NO_RESPONSE"] = "NO_RESPONSE";
      Error["NOT_SUPPORTED_TYPE"] = "NOT_SUPPORTED_TYPE";
      Error["GET_TYPE_ERROR"] = "GET_TYPE_ERROR";
  })(Error || (Error = {}));
  function genError(type, error) {
      return {
          AISdkError: true,
          type: type,
          error: error
      };
  }

  /*!
   * tts of ai plus sdk | bqliu hxli
   *
   * @todo
   *  - [ ] `end` 后 start 的请求需要能 cancel，可以考虑基于 `Observable` 来设计
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
      function TTS(processPCMBase64Data, onSuccess, onError, onComplete) {
          this.processPCMBase64Data = processPCMBase64Data;
          this.onSuccess = onSuccess;
          this.onError = onError;
          this.onComplete = onComplete;
          this.status = TTSStatus.idle;
      }
      TTS.prototype.start = function (startOption) {
          var _this = this;
          if (this.status !== TTSStatus.idle) {
              return;
          }
          var initialSyncId = '0';
          this.status = TTSStatus.sessionBegin;
          var ttsPayload = {
              svc: 'tts',
              syncid: initialSyncId.toString()
          };
          var rpcParam = __assign(__assign({}, startOption.ttsOption), { cmd: this.status, svc: ttsPayload.svc, syncid: ttsPayload.syncid });
          // user can invoke `end`
          this.end = this._end.bind(this, startOption, ttsPayload);
          return this.interact(rpcParam, startOption, ttsPayload)
              .then(function () { return _this.onSuccessAdaptor(); })
              .catch(function (err) {
              var error = genError(Error.NO_RESPONSE, err);
              _this.onErrorAdaptor(error);
              if (_this.status !== TTSStatus.sessionEnd && _this.status !== TTSStatus.idle) {
                  return _this._end(startOption, ttsPayload);
              }
              throw error;
          })
              .finally(function () { return _this.onCompleteAdaptor(); });
      };
      TTS.prototype._end = function (startOption, ttsPayload) {
          var _this = this;
          if (this.status === TTSStatus.sessionEnd || this.status === TTSStatus.idle) {
              return dummyResolvedPromise;
          }
          this.status = TTSStatus.sessionEnd;
          // if failed, sid is not exist
          if (!ttsPayload.sid) {
              return dummyResolvedPromise;
          }
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
              _this.status = TTSStatus.idle;
              throw err;
          });
      };
      TTS.prototype.onSuccessAdaptor = function () {
          if (this.onSuccess) {
              this.onSuccess();
          }
      };
      TTS.prototype.onCompleteAdaptor = function () {
          if (this.onComplete) {
              this.onComplete();
          }
      };
      TTS.prototype.onErrorAdaptor = function (error) {
          if (this.onError) {
              this.onError(error);
          }
      };
      TTS.prototype.processResponse = function (rpcResponseWrapper, startOption, ttsPayload) {
          var rpcResponse = rpcResponseWrapper.result;
          if (!rpcResponse) {
              var error = genError(Error.NO_RESPONSE, rpcResponseWrapper);
              this.onErrorAdaptor(error);
              return Promise.reject(error);
          }
          if (rpcResponse.ret !== 0) {
              var error = genError(Error.RESPONSE_ERROR, rpcResponseWrapper);
              this.onErrorAdaptor(error);
              return Promise.reject(error);
          }
          var _a = startOption.ttsOption, appid = _a.appid, extend_params = _a.extend_params;
          var basicParam = {
              appid: appid,
              extend_params: extend_params,
              sid: ttsPayload.sid || '',
              syncid: ttsPayload.syncid,
              svc: ttsPayload.svc
          };
          if (this.status === TTSStatus.sessionBegin) {
              ttsPayload.sid = rpcResponse.sid;
              this.status = TTSStatus.textWrite;
              var rpcParam = __assign(__assign({}, basicParam), { cmd: this.status, sid: ttsPayload.sid, data: jsBase64.Base64.encode(startOption.text) });
              return this.interact(rpcParam, startOption, ttsPayload);
          }
          if (this.status === TTSStatus.textWrite) {
              this.status = TTSStatus.getResult;
              var rpcParam = __assign(__assign({}, basicParam), { cmd: this.status });
              return this.interact(rpcParam, startOption, ttsPayload);
          }
          if (this.status === TTSStatus.getResult) {
              var response = rpcResponse;
              if (response.data) {
                  this.processPCMBase64Data(response.data);
              }
              if (response.ttsStatus === 0) {
                  // or `this.end()`
                  return this._end(startOption, ttsPayload);
              }
              var rpcParam = __assign(__assign({}, basicParam), { cmd: this.status });
              return this.interact(rpcParam, startOption, ttsPayload);
          }
          if (this.status === TTSStatus.sessionEnd) {
              this.status = TTSStatus.idle;
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

  function getResolvedPromise(value) {
      return Promise.resolve(value);
  }
  function noop() { }
  var TTSWithPlayer = /** @class */ (function () {
      function TTSWithPlayer($audio, onNext, // you can do some things like record. you can't transform now.
      onSuccess, // after all flows achived
      onError, // teardown or error msg
      onComplete // teardown
      ) {
          if (onNext === void 0) { onNext = noop; }
          if (onSuccess === void 0) { onSuccess = noop; }
          if (onError === void 0) { onError = noop; }
          if (onComplete === void 0) { onComplete = noop; }
          this.$audio = $audio;
          this.onNext = onNext;
          this.onSuccess = onSuccess;
          this.onError = onError;
          this.onComplete = onComplete;
          this.playing = false;
          this.internalProcessPCMBase64Data = this.internalProcessPCMBase64Data.bind(this);
          this.internalOnComplete = this.internalOnComplete.bind(this);
          this.internalOnError = this.internalOnError.bind(this);
          // for consistency
          this.onSuccess = this.onSuccess.bind(this);
          this.onNext = this.onNext.bind(this);
          this.tts = new TTS(this.internalProcessPCMBase64Data, this.onSuccess, this.internalOnError, this.internalOnComplete);
      }
      TTSWithPlayer.prototype.internalProcessPCMBase64Data = function (base64PcmData) {
          var _this = this;
          // just for record, no interceptor
          this.onNext(base64PcmData);
          if (!base64PcmData) {
              return;
          }
          if (!this.internalDummyPromise) {
              this.internalDummyPromise = getResolvedPromise();
          }
          if (!this.mp3Enc) {
              this.mp3Enc = new lamejs.Mp3Encoder(1, 16000, 64);
          }
          // in order
          this.internalDummyPromise = this.internalDummyPromise.then(function () {
              return Promise
                  .all([base64PcmData].map(function (base64PcmData) { return pcmToWav(base64WithoutPrefixToBlob(base64PcmData)); }))
                  .then(function (base64WavData) {
                  var blobs = base64WavData.map(function (x) { return base64ToWavBlob(x); });
                  var mp3Enc = _this.mp3Enc;
                  function transform(xs) {
                      return wavToMp3(mp3Enc, xs, { kbps: 64, flush: false });
                  }
                  return _this.player.appendFiles(blobs, transform).then(function () { return _this.$audio.play(); });
              });
          });
      };
      TTSWithPlayer.prototype.internalOnComplete = function () {
          var _this = this;
          if (this.mp3Enc) {
              var flush = this.mp3Enc.flush();
              if (flush.length > 0 && this.player) {
                  var blob = new Blob([flush]);
                  this.player.appendFiles([blob]).then(function () { return _this.$audio.play(); });
              }
          }
          this.internalDispose();
      };
      TTSWithPlayer.prototype.internalOnError = function () {
          this.internalDispose();
      };
      TTSWithPlayer.prototype.internalDispose = function (withPlayer) {
          if (withPlayer === void 0) { withPlayer = false; }
          this.mp3Enc = null;
          this.internalDummyPromise = null;
          if (withPlayer) {
              this.disposePlayer();
          }
      };
      TTSWithPlayer.prototype.disposePlayer = function () {
          if (this.player && this.$audio.src) {
              try {
                  URL.revokeObjectURL(this.$audio.src);
              }
              catch (e) { /* Ignore */ }
          }
          this.player = null;
      };
      TTSWithPlayer.prototype.destroy = function () {
          this.internalDispose(true);
      };
      TTSWithPlayer.prototype.start = function (option, forceStart) {
          var _this = this;
          if (forceStart === void 0) { forceStart = false; }
          if (!forceStart && this.tts.status !== TTSStatus.idle) {
              return getResolvedPromise();
          }
          var prev$ = getResolvedPromise();
          if (forceStart) {
              // use `noop` to prevent `throw` afterwards
              if (this.tts.end) {
                  prev$ = this.tts.end().catch(noop);
              }
          }
          // `finally` will return/throw the previous promise value/reason
          // so use `then`
          return prev$.then(function () {
              _this.disposePlayer();
              _this.player = new MSEPlayer();
              _this.$audio.src = URL.createObjectURL(_this.player.mediaSource);
              return _this.tts.start(option);
          });
      };
      TTSWithPlayer.prototype.end = function () {
          var _this = this;
          var end$ = getResolvedPromise();
          if (this.tts.end) {
              end$ = this.tts.end();
          }
          // use `Promise#resolve` to wrap this, because the `end` may return `undefined`
          end$.finally(function () { return _this.internalDispose(); });
          return end$;
      };
      // @todo
      TTSWithPlayer.prototype.getEstimatedDuration = function (text) {
          return text.length / 5;
      };
      // @todo
      TTSWithPlayer.prototype.onAudioDurationChange = function () {
          return 0;
      };
      // @todo
      TTSWithPlayer.prototype.play = function () { };
      // @todo
      TTSWithPlayer.prototype.pause = function () { };
      // @todo
      TTSWithPlayer.prototype.stop = function () { };
      return TTSWithPlayer;
  }());

  return TTSWithPlayer;

})));
//# sourceMappingURL=TTSWithPlayer.umd.js.map
