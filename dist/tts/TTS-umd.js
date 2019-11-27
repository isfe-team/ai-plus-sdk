(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('js-base64')) :
  typeof define === 'function' && define.amd ? define(['js-base64'], factory) :
  (global = global || self, global.TTS = factory(global.jsBase64));
}(this, (function (jsBase64) { 'use strict';

  function api(method, url, param, callback) {
      if (method === void 0) { method = 'POST'; }
      method = method.toUpperCase();
      var xmlHttp = new XMLHttpRequest();
      xmlHttp.open(method, url, true);
      xmlHttp.timeout = 5 * 1000;
      xmlHttp.setRequestHeader('Content-Type', 'application/json-rpc');
      xmlHttp.send(param);
      xmlHttp.onreadystatechange = function () {
          var ret = null;
          try {
              ret = xmlHttp.responseText;
          }
          catch (e) { }
          if (xmlHttp.readyState === 4) {
              if (xmlHttp.status >= 200 && xmlHttp.status < 300) {
                  callback(null, ret);
              }
              else {
                  if (xmlHttp.status === 500) {
                      callback(new Error('系统异常'), ret);
                      return;
                  }
                  if (xmlHttp.status === 504) {
                      callback(new Error('网络超时'), ret);
                      return;
                  }
                  callback(new Error('请求失败'), ret);
              }
          }
      };
  }

  var ttsStatus = {
      'idle': 'idle',
      'sessionBegin': 'ssb',
      'textWrite': 'txtw',
      'getResult': 'grs',
      'sessionEnd': 'sse' //session end 会话结束
  };
  // 公共参数
  var commonParam = {
      id: 1,
      jsonrpc: '2.0',
      method: 'deal_request',
      params: {
          svc: 'tts',
      }
  };
  function cloneDeep(data) {
      return JSON.parse(JSON.stringify(data));
  }
  function id(x) {
      return x;
  }
  var Tts = /** @class */ (function () {
      function Tts() {
          this.syncid = 0;
          this.status = null;
          this.extendParams = null;
          this.text = null;
          this.serverParams = null;
          this.sessionId = null;
      }
      // 初始化tts, 进行sessionBegin操作
      Tts.prototype.initTts = function (url, params, text) {
          if (url === void 0) { url = ''; }
          if (text === void 0) { text = ''; }
          this.text = text;
          this.serverParams = params;
          this.extendParams = params.extend_params;
          this.url = url;
          this.start();
      };
      Tts.prototype.start = function () {
          this.syncid = 0;
          this.status = ttsStatus.sessionBegin;
          var data = cloneDeep(commonParam);
          data.params = Object.assign({}, data.params, this.serverParams);
          data.params.cmd = this.status;
          data.params.syncid = this.syncid.toString();
          this.syncid++;
          this.getData(data);
      };
      // 获取tts各个阶段请求的参数
      Tts.prototype.transApiData = function (data) {
          if (data === void 0) { data = {}; }
          var msg = cloneDeep(commonParam);
          data.sid = this.sessionId;
          data.appid = this.appid;
          data.cmd = this.status;
          data.syncid = this.syncid.toString();
          data.extend_params = this.extendParams;
          msg.params = Object.assign({}, msg.params, data);
          return msg;
      };
      Tts.prototype.detailData = function (callback) {
          if (callback === void 0) { callback = id; }
          this.detailData = callback;
      };
      Tts.prototype.end = function () {
          if (!this.status || this.status === ttsStatus.sessionEnd || this.status === ttsStatus.idle) {
              return;
          }
          var data = { auth_id: this.serverParams.auth_id };
          this.status = ttsStatus.sessionEnd;
          var sseData = this.transApiData(data);
          this.getData(sseData);
      };
      Tts.prototype.onError = function (error) {
          if (error === void 0) { error = ''; }
          console.log(error);
      };
      Tts.prototype.processResponse = function (data) {
          if (!data) {
              this.onError();
              return;
          }
          this.syncid++;
          console.log('x', (jsBase64.Base64));
          var transData = JSON.parse(jsBase64.Base64.atob(data));
          if (!transData.result || transData.result.ret !== 0) {
              this.onError('数据有误');
              return;
          }
          if (this.status === ttsStatus.sessionBegin) {
              this.sessionId = transData.result.sid;
              this.status = ttsStatus.textWrite;
              var data_1 = { data: jsBase64.Base64.encode(this.text) };
              var txtwData = this.transApiData(data_1);
              this.getData(txtwData);
              return;
          }
          if (this.status === ttsStatus.textWrite) {
              this.status = ttsStatus.getResult;
              var grsData = this.transApiData();
              this.getData(grsData);
              return;
          }
          if (this.status === ttsStatus.getResult) {
              if (transData.result.data) {
                  this.detailData(transData.result.data);
              }
              if (transData.result.ttsStatus !== 0) {
                  var grsData = this.transApiData();
                  this.getData(grsData);
              }
              else {
                  this.end();
              }
              return;
          }
          if (this.status === ttsStatus.sessionEnd) {
              this.status = ttsStatus.idle;
          }
      };
      Tts.prototype.getData = function (data, method) {
          var _this = this;
          if (data === void 0) { data = {}; }
          if (method === void 0) { method = 'post'; }
          api(method, this.url, JSON.stringify(data), function (err, data) {
              if (!err) {
                  _this.processResponse(data);
              }
              else {
                  _this.onError(err);
              }
          });
      };
      return Tts;
  }());

  return Tts;

})));
//# sourceMappingURL=TTS-umd.js.map
