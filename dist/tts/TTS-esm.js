var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var base64 = createCommonjsModule(function (module, exports) {
(function (global, factory) {
     module.exports = factory(global)
        ;
}((
    typeof self !== 'undefined' ? self
        : typeof window !== 'undefined' ? window
        : typeof commonjsGlobal !== 'undefined' ? commonjsGlobal
: commonjsGlobal
), function(global) {
    // existing version for noConflict()
    global = global || {};
    var _Base64 = global.Base64;
    var version = "2.5.1";
    // if node.js and NOT React Native, we use Buffer
    var buffer;
    if ( module.exports) {
        try {
            buffer = eval("require('buffer').Buffer");
        } catch (err) {
            buffer = undefined;
        }
    }
    // constants
    var b64chars
        = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var b64tab = function(bin) {
        var t = {};
        for (var i = 0, l = bin.length; i < l; i++) t[bin.charAt(i)] = i;
        return t;
    }(b64chars);
    var fromCharCode = String.fromCharCode;
    // encoder stuff
    var cb_utob = function(c) {
        if (c.length < 2) {
            var cc = c.charCodeAt(0);
            return cc < 0x80 ? c
                : cc < 0x800 ? (fromCharCode(0xc0 | (cc >>> 6))
                                + fromCharCode(0x80 | (cc & 0x3f)))
                : (fromCharCode(0xe0 | ((cc >>> 12) & 0x0f))
                   + fromCharCode(0x80 | ((cc >>>  6) & 0x3f))
                   + fromCharCode(0x80 | ( cc         & 0x3f)));
        } else {
            var cc = 0x10000
                + (c.charCodeAt(0) - 0xD800) * 0x400
                + (c.charCodeAt(1) - 0xDC00);
            return (fromCharCode(0xf0 | ((cc >>> 18) & 0x07))
                    + fromCharCode(0x80 | ((cc >>> 12) & 0x3f))
                    + fromCharCode(0x80 | ((cc >>>  6) & 0x3f))
                    + fromCharCode(0x80 | ( cc         & 0x3f)));
        }
    };
    var re_utob = /[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g;
    var utob = function(u) {
        return u.replace(re_utob, cb_utob);
    };
    var cb_encode = function(ccc) {
        var padlen = [0, 2, 1][ccc.length % 3],
        ord = ccc.charCodeAt(0) << 16
            | ((ccc.length > 1 ? ccc.charCodeAt(1) : 0) << 8)
            | ((ccc.length > 2 ? ccc.charCodeAt(2) : 0)),
        chars = [
            b64chars.charAt( ord >>> 18),
            b64chars.charAt((ord >>> 12) & 63),
            padlen >= 2 ? '=' : b64chars.charAt((ord >>> 6) & 63),
            padlen >= 1 ? '=' : b64chars.charAt(ord & 63)
        ];
        return chars.join('');
    };
    var btoa = global.btoa ? function(b) {
        return global.btoa(b);
    } : function(b) {
        return b.replace(/[\s\S]{1,3}/g, cb_encode);
    };
    var _encode = buffer ?
        buffer.from && Uint8Array && buffer.from !== Uint8Array.from
        ? function (u) {
            return (u.constructor === buffer.constructor ? u : buffer.from(u))
                .toString('base64')
        }
        :  function (u) {
            return (u.constructor === buffer.constructor ? u : new  buffer(u))
                .toString('base64')
        }
        : function (u) { return btoa(utob(u)) }
    ;
    var encode = function(u, urisafe) {
        return !urisafe
            ? _encode(String(u))
            : _encode(String(u)).replace(/[+\/]/g, function(m0) {
                return m0 == '+' ? '-' : '_';
            }).replace(/=/g, '');
    };
    var encodeURI = function(u) { return encode(u, true) };
    // decoder stuff
    var re_btou = new RegExp([
        '[\xC0-\xDF][\x80-\xBF]',
        '[\xE0-\xEF][\x80-\xBF]{2}',
        '[\xF0-\xF7][\x80-\xBF]{3}'
    ].join('|'), 'g');
    var cb_btou = function(cccc) {
        switch(cccc.length) {
        case 4:
            var cp = ((0x07 & cccc.charCodeAt(0)) << 18)
                |    ((0x3f & cccc.charCodeAt(1)) << 12)
                |    ((0x3f & cccc.charCodeAt(2)) <<  6)
                |     (0x3f & cccc.charCodeAt(3)),
            offset = cp - 0x10000;
            return (fromCharCode((offset  >>> 10) + 0xD800)
                    + fromCharCode((offset & 0x3FF) + 0xDC00));
        case 3:
            return fromCharCode(
                ((0x0f & cccc.charCodeAt(0)) << 12)
                    | ((0x3f & cccc.charCodeAt(1)) << 6)
                    |  (0x3f & cccc.charCodeAt(2))
            );
        default:
            return  fromCharCode(
                ((0x1f & cccc.charCodeAt(0)) << 6)
                    |  (0x3f & cccc.charCodeAt(1))
            );
        }
    };
    var btou = function(b) {
        return b.replace(re_btou, cb_btou);
    };
    var cb_decode = function(cccc) {
        var len = cccc.length,
        padlen = len % 4,
        n = (len > 0 ? b64tab[cccc.charAt(0)] << 18 : 0)
            | (len > 1 ? b64tab[cccc.charAt(1)] << 12 : 0)
            | (len > 2 ? b64tab[cccc.charAt(2)] <<  6 : 0)
            | (len > 3 ? b64tab[cccc.charAt(3)]       : 0),
        chars = [
            fromCharCode( n >>> 16),
            fromCharCode((n >>>  8) & 0xff),
            fromCharCode( n         & 0xff)
        ];
        chars.length -= [0, 0, 2, 1][padlen];
        return chars.join('');
    };
    var _atob = global.atob ? function(a) {
        return global.atob(a);
    } : function(a){
        return a.replace(/\S{1,4}/g, cb_decode);
    };
    var atob = function(a) {
        return _atob(String(a).replace(/[^A-Za-z0-9\+\/]/g, ''));
    };
    var _decode = buffer ?
        buffer.from && Uint8Array && buffer.from !== Uint8Array.from
        ? function(a) {
            return (a.constructor === buffer.constructor
                    ? a : buffer.from(a, 'base64')).toString();
        }
        : function(a) {
            return (a.constructor === buffer.constructor
                    ? a : new buffer(a, 'base64')).toString();
        }
        : function(a) { return btou(_atob(a)) };
    var decode = function(a){
        return _decode(
            String(a).replace(/[-_]/g, function(m0) { return m0 == '-' ? '+' : '/' })
                .replace(/[^A-Za-z0-9\+\/]/g, '')
        );
    };
    var noConflict = function() {
        var Base64 = global.Base64;
        global.Base64 = _Base64;
        return Base64;
    };
    // export Base64
    global.Base64 = {
        VERSION: version,
        atob: atob,
        btoa: btoa,
        fromBase64: decode,
        toBase64: encode,
        utob: utob,
        encode: encode,
        encodeURI: encodeURI,
        btou: btou,
        decode: decode,
        noConflict: noConflict,
        __buffer__: buffer
    };
    // if ES5 is available, make Base64.extendString() available
    if (typeof Object.defineProperty === 'function') {
        var noEnum = function(v){
            return {value:v,enumerable:false,writable:true,configurable:true};
        };
        global.Base64.extendString = function () {
            Object.defineProperty(
                String.prototype, 'fromBase64', noEnum(function () {
                    return decode(this)
                }));
            Object.defineProperty(
                String.prototype, 'toBase64', noEnum(function (urisafe) {
                    return encode(this, urisafe)
                }));
            Object.defineProperty(
                String.prototype, 'toBase64URI', noEnum(function () {
                    return encode(this, true)
                }));
        };
    }
    //
    // export Base64 to the namespace
    //
    if (global['Meteor']) { // Meteor.js
        Base64 = global.Base64;
    }
    // module.exports and AMD are mutually exclusive.
    // module.exports has precedence.
    if ( module.exports) {
        module.exports.Base64 = global.Base64;
    }
    // that's it!
    return {Base64: global.Base64}
}));
});
var base64_1 = base64.Base64;

function http(url, method, param) {
    if (method === void 0) { method = 'POST'; }
    return new Promise(function (resolve, reject) {
        method = method.toUpperCase();
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open(method, url, true);
        xmlHttp.timeout = 5 * 1000;
        xmlHttp.setRequestHeader('Content-Type', 'application/json-rpc');
        xmlHttp.send(param);
        xmlHttp.onreadystatechange = function () {
            if (xmlHttp.readyState === 4) {
                if (xmlHttp.status >= 200 && xmlHttp.status < 300) {
                    var ret = null;
                    try {
                        ret = JSON.parse(base64_1.atob(xmlHttp.responseText));
                    }
                    catch (e) {
                        reject(e);
                        return;
                    }
                    resolve(ret);
                    return;
                }
                if (xmlHttp.status === 500) {
                    reject(new Error('系统异常'));
                    return;
                }
                if (xmlHttp.status === 504) {
                    reject(new Error('网络超时'));
                    return;
                }
                reject(new Error('请求失败'));
            }
        };
    });
}
//# sourceMappingURL=http.js.map

/*!
 * ai_plus_sdk | bqliu hxli
 *
 * @todo
 *  - [ ] Error 处理
 *  - [ ] 类型提取至类型模块
 *  - [ ] net/http 类型优化
 *  - [ ] rpcParam 入参构造优化
 */
var TTSStatus;
(function (TTSStatus) {
    TTSStatus["idle"] = "idle";
    TTSStatus["sessionBegin"] = "ssb";
    TTSStatus["textWrite"] = "txtw";
    TTSStatus["getResult"] = "grs";
    TTSStatus["sessionEnd"] = "sse"; // 会话结束
})(TTSStatus || (TTSStatus = {}));
function genRPCMessage(rpcParam) {
    return {
        id: 1,
        jsonrpc: '2.0',
        method: 'deal_request',
        params: rpcParam
    };
}
var TTS = /** @class */ (function () {
    function TTS(fn) {
        this.status = TTSStatus.idle;
        this.processPCMBase64Data = fn;
    }
    TTS.prototype.start = function (startOption) {
        if (this.status !== TTSStatus.idle) {
            return;
        }
        var initialSyncId = -1;
        this.status = TTSStatus.sessionBegin;
        var rpcParam = startOption.ttsOption;
        rpcParam.cmd = this.status;
        var ttsPayload = {
            svc: 'tts',
            syncid: initialSyncId.toString()
        };
        rpcParam.svc = ttsPayload.svc;
        this.getData(rpcParam, startOption, ttsPayload);
    };
    TTS.prototype.end = function (startOption, ttsPayload) {
        var _this = this;
        if (this.status === TTSStatus.sessionEnd || this.status === TTSStatus.idle) {
            return;
        }
        this.status = TTSStatus.sessionEnd;
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
        this.getData(rpcParam, startOption, ttsPayload).catch(function () {
            _this.status === TTSStatus.idle;
        });
    };
    TTS.prototype.onError = function (error) {
        if (error === void 0) { error = ''; }
        console.log(error);
    };
    TTS.prototype.processResponse = function (rpcResponse, startOption, ttsPayload) {
        if (!rpcResponse) {
            this.onError();
            return;
        }
        if (rpcResponse.ret !== 0) {
            this.onError('数据有误');
            return;
        }
        if (this.status === TTSStatus.sessionBegin) {
            ttsPayload.sid = rpcResponse.sid;
            this.status = TTSStatus.textWrite;
            var _a = startOption.ttsOption, appid = _a.appid, extend_params = _a.extend_params;
            var rpcParam = {
                appid: appid,
                extend_params: extend_params,
                cmd: this.status,
                sid: ttsPayload.sid,
                syncid: ttsPayload.syncid,
                svc: ttsPayload.svc,
                data: base64_1.encode(startOption.text)
            };
            this.getData(rpcParam, startOption, ttsPayload);
            return;
        }
        if (this.status === TTSStatus.textWrite) {
            this.status = TTSStatus.getResult;
            var _b = startOption.ttsOption, appid = _b.appid, extend_params = _b.extend_params;
            var rpcParam = {
                appid: appid,
                extend_params: extend_params,
                cmd: this.status,
                sid: ttsPayload.sid,
                syncid: ttsPayload.syncid,
                svc: ttsPayload.svc
            };
            this.getData(rpcParam, startOption, ttsPayload);
            return;
        }
        if (this.status === TTSStatus.getResult) {
            var response = rpcResponse;
            if (response.data) {
                this.processPCMBase64Data(response.data);
            }
            if (response.ttsStatus === 0) {
                this.end(startOption, ttsPayload);
                return;
            }
            var _c = startOption.ttsOption, appid = _c.appid, extend_params = _c.extend_params;
            var rpcParam = {
                appid: appid,
                extend_params: extend_params,
                cmd: this.status,
                sid: ttsPayload.sid,
                syncid: ttsPayload.syncid,
                svc: ttsPayload.svc
            };
            this.getData(rpcParam, startOption, ttsPayload);
        }
        if (this.status === TTSStatus.sessionEnd) {
            this.status = TTSStatus.idle;
        }
    };
    TTS.prototype.getData = function (rpcParam, option, ttsPayload) {
        var _this = this;
        ttsPayload.syncid = (+ttsPayload.syncid + 1).toString();
        var rpcMessage = genRPCMessage(rpcParam);
        return http(option.url, option.apiMethod, JSON.stringify(rpcMessage)).then(function (data) {
            _this.processResponse(data.result, option, ttsPayload);
            console.log(data.result);
            return data.result;
        }).catch(function (err) {
            _this.onError(err);
            throw err;
        });
    };
    return TTS;
}());
//# sourceMappingURL=index.js.map

export default TTS;
//# sourceMappingURL=TTS-esm.js.map
