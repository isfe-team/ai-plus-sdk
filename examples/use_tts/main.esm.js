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

function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
}

function __spread() {
    for (var ar = [], i = 0; i < arguments.length; i++)
        ar = ar.concat(__read(arguments[i]));
    return ar;
}

/**
 * @example
 * const player = new MSEPlayer()
 * player.appendFiles(files)
 * @see https://developer.mozilla.org/zh-CN/docs/Web/API/Media_Source_Extensions_API
 */
var MSEPlayer = /** @class */ (function () {
    function MSEPlayer(option) {
        var _this = this;
        if (option === void 0) { option = {}; }
        var _a = option.files, files = _a === void 0 ? [] : _a, _b = option.mimeType, mimeType = _b === void 0 ? 'audio/mpeg' : _b, onError = option.onError, _c = option.ignoreError, ignoreError = _c === void 0 ? true : _c, _d = option.transformer, transformer = _d === void 0 ? identity : _d;
        this.envSupported = MSEPlayer.checkEnvSupported();
        this.onError = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (isFunction(onError)) {
                onError.call.apply(onError, __spread([_this], args));
            }
        };
        if (!this.envSupported) {
            this.onError(genError('MEDIA_SOURCE_NOT_SUPPORTED'));
            return;
        }
        if (!MediaSource.isTypeSupported(mimeType)) {
            this.onError(genError('MIME_TYPE_NOT_SUPPORTED'));
            return;
        }
        this.mimeType = mimeType;
        this.sourceBuffer = null;
        this.ignoreError = ignoreError;
        this.transformer = transformer;
        this.mediaSource = new MediaSource();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        var player = this;
        function onSourceOpenWithPromise() {
            return new Promise(function (resolve) {
                var mediaSource = player.mediaSource;
                mediaSource.addEventListener('sourceopen', onSourceOpen);
                function onSourceOpen() {
                    mediaSource.removeEventListener('sourceopen', onSourceOpen);
                    player.sourceBuffer = mediaSource.addSourceBuffer(player.mimeType);
                    resolve();
                }
            });
        }
        this.lastAppend$ = onSourceOpenWithPromise();
        if (files.length > 0) {
            this.appendFiles(files);
        }
    }
    MSEPlayer.checkEnvSupported = function () {
        return 'MediaSource' in window;
    };
    /**
     * appendFiles
     */
    MSEPlayer.prototype.appendFiles = function (files, transformer, ignorePrevError) {
        var _this = this;
        if (files === void 0) { files = []; }
        if (transformer === void 0) { transformer = identity; }
        if (ignorePrevError === void 0) { ignorePrevError = true; }
        files = toArray(files);
        if (ignorePrevError) {
            this.lastAppend$.catch(function () { });
        }
        var combinedTransformer = function (buffers) {
            return Promise.resolve(buffers)
                .then(transformer) // specific transformer
                .then(function (buffers) { return _this.transformer(buffers); }); // common transformer
        };
        var currentAppend$ = this.lastAppend$.then(function () { return combine(files, _this.mediaSource, _this.sourceBuffer, combinedTransformer); });
        this.lastAppend$ = currentAppend$.catch(function (err) {
            _this.onError(genError('APPEND_ERROR', err));
        });
        return this.ignoreError ? this.lastAppend$ : currentAppend$;
    };
    MSEPlayer.prototype.destroy = function () {
        this.mediaSource = null;
        this.sourceBuffer = null;
    };
    return MSEPlayer;
}());
/**
 * readBuffer - read blobs and get arrayBuffers
 */
function read(blobs) {
    return Promise.all(blobs.map(function (blob) {
        return new Promise(function (resolve, reject) {
            // hmmm, no need to unbind, if it's smart enough
            var reader = new FileReader();
            reader.addEventListener('load', function () {
                // the result must be `ArrayBuffer`
                resolve(reader.result);
            });
            reader.readAsArrayBuffer(blob);
            reader.addEventListener('error', function (err) {
                reject(genError('READ_FILE_ERROR', err));
            });
        });
    }));
}
/**
 * buffer - append buffers to specific sourceBuffer
 */
function buffer(mediaSource, sourceBuffer, buffers) {
    return new Promise(function (resolve, reject) {
        sourceBuffer.addEventListener('updateend', onUpdateEnd);
        sourceBuffer.addEventListener('error', onAppendError);
        // it's async when `appendBuffer`,
        // we should use `updateend` event(triggers when `append` or `removed`) to ensure the orders
        function onUpdateEnd() {
            if (buffers.length === 0) {
                mediaSource.endOfStream();
                // don't forget to remove
                sourceBuffer.removeEventListener('updateend', onUpdateEnd);
                sourceBuffer.removeEventListener('error', onAppendError);
                resolve();
                return;
            }
            sourceBuffer.appendBuffer(buffers.shift());
        }
        function onAppendError(err) {
            // no need to unbind `updateend` and invoke `endOfStream` here,
            // because when `error` occurs, `updateend` will go according to the spec.
            // @see https://w3c.github.io/media-source/#sourcebuffer-append-error
            reject(genError('APPEND_BUFFER_ERROR', err));
        }
        // trigger first buffer
        onUpdateEnd();
    });
}
/**
 * combine - combine the `read` process and the `buffer` process
 * to ensure the `read` process is excuted before the `buffer` process.
 * just a combination.
 */
function combine(files, mediaSource, sourceBuffer, transformer) {
    return read(files).then(function (buffers) { return transformer(buffers); }).then(function (buffers) { return buffer(mediaSource, sourceBuffer, buffers); });
}
/**
 * identity
 */
function identity(x) {
    return x;
}
/**
 * isFunction
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFunction(x) {
    return Object.prototype.toString.call(x) === '[object Function]';
}
/**
 * toArray
 */
function toArray(xs) {
    return [].slice.call(xs);
}
/**
 * genError
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function genError(type, error) {
    return {
        type: type,
        error: error
    };
}
//# sourceMappingURL=MSEPlayer.js.map

/**
 * pcmToWav
 * @example
 * pcmToWav(file).then((src) => $audio.src = src)
 */
function pcmToWav(file, sampleRate, sampleBits, channelCount) {
    if (sampleRate === void 0) { sampleRate = 16000; }
    if (sampleBits === void 0) { sampleBits = 16; }
    if (channelCount === void 0) { channelCount = 1; }
    var reader = new FileReader();
    // no need to `removeEventListener` if smart enough
    var promise = new Promise(function (resolve, reject) {
        reader.addEventListener('load', function () {
            var buffer = addWavHeader(reader.result, sampleRate, sampleBits, channelCount);
            resolve(bufferToBase64(buffer));
        });
        reader.addEventListener('error', function (err) {
            reject(err);
        });
    });
    reader.readAsArrayBuffer(file);
    return promise;
}
/**
 * addWavHeader
 */
function addWavHeader(samples, sampleRate, sampleBits, channelCount) {
    var dataLength = samples.byteLength;
    var buffer = new ArrayBuffer(44 + dataLength);
    var view = new DataView(buffer);
    function writeString(view, offset, str) {
        for (var i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }
    var offset = 0;
    /* 资源交换文件标识符 */
    writeString(view, offset, 'RIFF');
    offset += 4;
    /* 下个地址开始到文件尾总字节数,即文件大小-8 */
    view.setUint32(offset, /*32*/ 36 + dataLength, true);
    offset += 4;
    /* WAV文件标志 */
    writeString(view, offset, 'WAVE');
    offset += 4;
    /* 波形格式标志 */
    writeString(view, offset, 'fmt ');
    offset += 4;
    /* 过滤字节,一般为 0x10 = 16 */
    view.setUint32(offset, 16, true);
    offset += 4;
    /* 格式类别 (PCM形式采样数据) */
    view.setUint16(offset, 1, true);
    offset += 2;
    /* 通道数 */
    view.setUint16(offset, channelCount, true);
    offset += 2;
    /* 采样率,每秒样本数,表示每个通道的播放速度 */
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    /* 波形数据传输率 (每秒平均字节数) 通道数×每秒数据位数×每样本数据位/8 */
    view.setUint32(offset, sampleRate * channelCount * (sampleBits / 8), true);
    offset += 4;
    /* 快数据调整数 采样一次占用字节数 通道数×每样本的数据位数/8 */
    view.setUint16(offset, channelCount * (sampleBits / 8), true);
    offset += 2;
    /* 每样本数据位数 */
    view.setUint16(offset, sampleBits, true);
    offset += 2;
    /* 数据标识符 */
    writeString(view, offset, 'data');
    offset += 4;
    /* 采样数据总数,即数据总大小-44 */
    view.setUint32(offset, dataLength, true);
    offset += 4;
    function floatTo32BitPCM(output, offset, input) {
        var i32xs = new Int32Array(input);
        for (var i = 0; i < i32xs.length; i++, offset += 4) {
            output.setInt32(offset, i32xs[i], true);
        }
    }
    function floatTo16BitPCM(output, offset, input) {
        var i16xs = new Int16Array(input);
        for (var i = 0; i < i16xs.length; i++, offset += 2) {
            output.setInt16(offset, i16xs[i], true);
        }
    }
    function floatTo8BitPCM(output, offset, input) {
        var i8xs = new Int8Array(input);
        for (var i = 0; i < i8xs.length; i++, offset++) {
            output.setInt8(offset, i8xs[i]);
        }
    }
    if (sampleBits === 16) {
        floatTo16BitPCM(view, 44, samples);
    }
    else if (sampleBits === 8) {
        floatTo8BitPCM(view, 44, samples);
    }
    else {
        floatTo32BitPCM(view, 44, samples);
    }
    return view.buffer;
}
/**
 * bufferToBase64
 */
function bufferToBase64(buffer) {
    var content = new Uint8Array(buffer).reduce(function (data, byte) {
        return data + String.fromCharCode(byte);
    }, '');
    return "data:audio/wav;base64," + btoa(content);
}
//# sourceMappingURL=pcmToWav.js.map

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
                    var ret = JSON.parse(base64_1.atob(xhr.responseText));
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
/** status of tts */
var TTSStatus;
(function (TTSStatus) {
    TTSStatus["idle"] = "idle";
    TTSStatus["sessionBegin"] = "ssb";
    TTSStatus["textWrite"] = "txtw";
    TTSStatus["getResult"] = "grs";
    TTSStatus["sessionEnd"] = "sse"; // 会话结束
})(TTSStatus || (TTSStatus = {}));
//# sourceMappingURL=types.js.map

/*!
 * error | bqliu
 */
var Error;
(function (Error) {
    Error["RESPONSE_ERROR"] = "RESPONSE_ERROR";
    Error["NO_RESPONSE"] = "NO_RESPONSE";
})(Error || (Error = {}));
function genError$1(type, error) {
    return {
        AISdkError: true,
        type: type,
        error: error
    };
}
//# sourceMappingURL=error.js.map

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
    function TTS(processPCMBase64Data, onError) {
        this.processPCMBase64Data = processPCMBase64Data;
        this.onError = onError;
        this.status = TTSStatus.idle;
    }
    TTS.prototype.start = function (startOption) {
        var _this = this;
        if (this.status !== TTSStatus.idle) {
            return;
        }
        var initialSyncId = '-1';
        this.status = TTSStatus.sessionBegin;
        var ttsPayload = {
            svc: 'tts',
            syncid: initialSyncId
        };
        var rpcParam = __assign(__assign({}, startOption.ttsOption), { cmd: this.status, svc: ttsPayload.svc, syncid: ttsPayload.syncid });
        // user can invoke `end`
        this.end = this._end.bind(this, startOption, ttsPayload);
        return this.interact(rpcParam, startOption, ttsPayload)
            .catch(function (err) {
            var error = genError$1(Error.NO_RESPONSE, err);
            _this.onErrorAdaptor(error);
            if (_this.status !== TTSStatus.sessionEnd && _this.status !== TTSStatus.idle) {
                return _this._end(startOption, ttsPayload);
            }
            throw error;
        });
    };
    TTS.prototype._end = function (startOption, ttsPayload) {
        var _this = this;
        if (this.status === TTSStatus.sessionEnd || this.status === TTSStatus.idle) {
            return dummyResolvedPromise;
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
        return this.interact(rpcParam, startOption, ttsPayload).catch(function (err) {
            _this.status === TTSStatus.idle;
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
            var error = genError$1(Error.NO_RESPONSE, rpcResponseWrapper);
            this.onErrorAdaptor(error);
            return Promise.reject(error);
        }
        if (rpcResponse.ret !== 0) {
            var error = genError$1(Error.RESPONSE_ERROR, rpcResponseWrapper);
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
        if (this.status === TTSStatus.sessionBegin) {
            ttsPayload.sid = rpcResponse.sid;
            this.status = TTSStatus.textWrite;
            var rpcParam = __assign(__assign({}, basicParam), { data: base64_1.encode(startOption.text) });
            return this.interact(rpcParam, startOption, ttsPayload);
        }
        if (this.status === TTSStatus.textWrite) {
            this.status = TTSStatus.getResult;
            var rpcParam = basicParam;
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
            var rpcParam = basicParam;
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
//# sourceMappingURL=index.js.map

/**
 * use [lamejs](https://github.com/zhuker/lamejs#real-example) to encode mp3
 * @todo
 *  - [ ] to `ts`
 */

// import lamejs from 'lamejs'

function wavToMp3 (buffers) {
  return Promise.all(buffers.map((buf) => new Promise((resolve, reject) => {
    const wav = lamejs.WavHeader.readHeader(new DataView(buf));
    const samples = new Int16Array(buf, wav.dataOffset, wav.dataLen / 2);
    const buffer = [ ];
    const mp3enc = new lamejs.Mp3Encoder(wav.channels, wav.sampleRate, 128);

    let remaining = samples.length;
    const maxSamples = 1152;
    for (let i = 0; remaining >= maxSamples; i += maxSamples) {
      const mono = samples.subarray(i, i + maxSamples);
      const mp3buf = mp3enc.encodeBuffer(mono);
      if (mp3buf.length > 0) {
        buffer.push(new Int8Array(mp3buf));
      }
      remaining -= maxSamples;
    }

    const flush = mp3enc.flush();
    if (flush.length > 0){
      buffer.push(new Int8Array(flush));
    }

    const blob = new Blob(buffer, { type: 'audio/mpeg' });
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve(reader.result);
    });
    reader.addEventListener('error', (error) => {
      reject(error);
    });

    reader.readAsArrayBuffer(blob);
  })))
}

/*!
 * entry | bqliu
 */
var $audio = document.querySelector('audio');
var tts = new TTS(function (base64PcmData) {
    if (base64PcmData) {
        Promise
            .all([base64PcmData].map(function (base64PcmData) { return pcmToWav(base64ToBlob(base64PcmData, false)); }))
            .then(function (base64WavData) {
            var blobs = base64WavData.map(function (x) { return base64ToBlob(x); });
            player.appendFiles(blobs, wavToMp3).then(function () { return $audio.play(); });
        });
    }
});
var player = null;
var ttsOption = {
    appid: 'test1234',
    aue: 'raw',
    auf: '4',
    auth_id: '1234567890',
    bgs: 0,
    engine_name: 'tts_online',
    extend_params: '{"params":"token=appid123,ability=ab_tts,vol=0,spd=0,pit=0,effect=0,bgs=0"}',
    pit: 0,
    ram: 0,
    spd: 0,
    vid: '65620',
    vol: 0
};
var $input = document.querySelector('#selector');
var $button = document.querySelector('#button');
$button.addEventListener('click', function () {
    player = new MSEPlayer({ onError: console.log });
    $audio.src = URL.createObjectURL(player.mediaSource);
    tts.start({
        url: 'http://172.31.3.142:8087/tts/',
        // url: 'http://172.31.3.142:8087/tts_online/',
        text: $input.value,
        ttsOption: ttsOption
    });
});
function base64ToBlob(baseStr, isBase64) {
    if (isBase64 === void 0) { isBase64 = true; }
    var data = isBase64 ? baseStr.split(',')[1] : baseStr;
    var bstr = atob(data);
    var n = bstr.length;
    var u8arr = new Uint8Array(n);
    // 将二进制数据存入Uint8Array类型的数组中
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: 'wav' });
}
//# sourceMappingURL=index.js.map
//# sourceMappingURL=main.esm.js.map
