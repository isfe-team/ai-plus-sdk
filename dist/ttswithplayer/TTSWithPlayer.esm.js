import lamejs from 'lamejs';
import { Base64 } from 'js-base64';

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
 * Simple helper | bqliu
 */
function readAsArrayBuffer$(x) {
    return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        // hmmm, no need to unbind, if it's smart enough
        fr.addEventListener('load', function () { return resolve(fr.result); });
        fr.addEventListener('error', function (e) { return reject(e); });
        fr.readAsArrayBuffer(x);
    });
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
        return readAsArrayBuffer$(blob).then(null, function (err) { return Promise.reject(genError('READ_FILE_ERROR', err)); });
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

/**
 * use [lamejs](https://github.com/zhuker/lamejs#real-example) to encode mp3
 *
 * BE CARE, if use rollup to import lamejs, you will fail, so you need to use
 * [rollup-plugin-external-globals](https://github.com/eight04/rollup-plugin-external-globals)
 * ```js
 * // simple rollup config
 * const config = {
 *   plugins: [nodeResolve(), commonjs(), rollupTypescript(), externalGlobals({ lamejs: 'lamejs' })]
 * }
 * ```
 * @todo
 *  - [ ] pcmToMp3
 */
function wavToMp3(mp3enc, buffers, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.kbps, kbps = _c === void 0 ? 128 : _c, _d = _b.flush, flush = _d === void 0 ? true : _d, _e = _b.optimize // if optimize, we'll slice into pieces, but it will result in unbelivable result
    , optimize = _e === void 0 ? false : _e // if optimize, we'll slice into pieces, but it will result in unbelivable result
    ;
    return Promise.all(buffers.map(function (buf) {
        var wav = lamejs.WavHeader.readHeader(new DataView(buf));
        var samples = new Int16Array(buf, wav.dataOffset, wav.dataLen / 2);
        var buffer = [];
        if (!mp3enc) {
            mp3enc = new lamejs.Mp3Encoder(wav.channels, wav.sampleRate, kbps);
        }
        if (optimize) {
            var remaining = samples.length;
            var maxSamples = 1152;
            for (var i = 0; remaining >= maxSamples; i += maxSamples) {
                var mono = samples.subarray(i, i + maxSamples);
                var mp3buf = mp3enc.encodeBuffer(mono);
                if (mp3buf.length > 0) {
                    buffer.push(new Int8Array(mp3buf));
                }
                remaining -= maxSamples;
            }
        }
        else {
            var mp3buf = mp3enc.encodeBuffer(samples);
            buffer.push(new Int8Array(mp3buf));
        }
        if (flush) {
            var end = mp3enc.flush();
            if (end.length > 0) {
                buffer.push(new Int8Array(end));
            }
        }
        var blob = new Blob(buffer, { type: 'audio/mpeg' });
        return readAsArrayBuffer$(blob);
    }));
}

/**
 * bufferToBase64
 */
function bufferToBase64Wav(buffer) {
    var content = new Uint8Array(buffer).reduce(function (data, byte) {
        return data + String.fromCharCode(byte);
    }, '');
    return btoa(content);
}

/**
 * bufferToBase64Wav
 */
function bufferToBase64Wav$1(buffer) {
    return "data:audio/wav;base64," + bufferToBase64Wav(buffer);
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
 * pcmToWav
 * @example
 * pcmToWav(file).then((src) => $audio.src = src)
 */
function pcmToWav(file, sampleRate, sampleBits, channelCount) {
    if (sampleRate === void 0) { sampleRate = 16000; }
    if (sampleBits === void 0) { sampleBits = 16; }
    if (channelCount === void 0) { channelCount = 1; }
    return readAsArrayBuffer$(file).then(function (buffer) {
        return bufferToBase64Wav$1(addWavHeader(buffer, sampleRate, sampleBits, channelCount));
    });
}

function base64WithoutPrefixToBlob (str, options) {
    var bstr = atob(str);
    var n = bstr.length;
    var u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], options);
}

function base64ToBlob(str, options) {
    return base64WithoutPrefixToBlob(str.split(',')[1], options);
}

function base64ToWavBlob(str) {
    return base64ToBlob(str, { type: 'wav' });
}

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
                    var ret = JSON.parse(Base64.atob(xhr.responseText));
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
})(Error || (Error = {}));
function genError$1(type, error) {
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
            var error = genError$1(Error.NO_RESPONSE, err);
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
            sid: ttsPayload.sid || '',
            syncid: ttsPayload.syncid,
            svc: ttsPayload.svc
        };
        if (this.status === TTSStatus.sessionBegin) {
            ttsPayload.sid = rpcResponse.sid;
            this.status = TTSStatus.textWrite;
            var rpcParam = __assign(__assign({}, basicParam), { cmd: this.status, sid: ttsPayload.sid, data: Base64.encode(startOption.text) });
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

export default TTSWithPlayer;
//# sourceMappingURL=TTSWithPlayer.esm.js.map
