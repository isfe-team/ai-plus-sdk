import MSEPlayer from '@isfe/mse-player/src/MSEPlayer'
import wavToMp3 from '@isfe/mse-player/src/helpers/wavToMp3'
import pcmToWav from '@isfe/mse-player/src/helpers/pcmToWav'
import base64WithoutPrefixToBlob from '@isfe/mse-player/src/helpers/base64WithoutPrefixToBlob'
import base64ToWavBlob from '@isfe/mse-player/src/helpers/base64ToWavBlob'
import lamejs from 'lamejs'
import { TTSStatus } from './types'
import TTS, { StartOption } from './index'

function getResolvedPromise<T> (value?: T) {
  return Promise.resolve(value)
}

function noop () { }
  
export default class TTSWithPlayer {
  tts: TTS;
  playing: boolean = false;
  player!: MSEPlayer | null;
  private internalDummyPromise!: Promise<void> | null;
  private mp3Enc!: lamejs.Mp3Encoder | null;
  constructor(public $audio: HTMLAudioElement, public onNext: Function = noop, // you can do some things like record. you can't transform now.
    public onSuccess: Function = noop, // after all flows achived
    public onError: Function = noop, // teardown or error msg
    public onComplete: Function = noop // teardown
  ) {
    this.internalProcessPCMBase64Data = this.internalProcessPCMBase64Data.bind(this);
    this.internalOnComplete = this.internalOnComplete.bind(this);
    this.internalOnError = this.internalOnError.bind(this);
    // for consistency
    this.onSuccess = this.onSuccess.bind(this);
    this.onNext = this.onNext.bind(this);
    this.tts = new TTS(this.internalProcessPCMBase64Data, this.onSuccess, this.internalOnError, this.internalOnComplete);
  }
  private internalProcessPCMBase64Data(base64PcmData: string) {
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
    this.internalDummyPromise = this.internalDummyPromise.then(() => {
      return Promise
        .all([base64PcmData].map((base64PcmData) => pcmToWav(base64WithoutPrefixToBlob(base64PcmData))))
        .then((base64WavData) => {
          const blobs = base64WavData.map((x) => base64ToWavBlob(x));
          const mp3Enc = this.mp3Enc as lamejs.Mp3Encoder;
          function transform(xs: Array<ArrayBuffer>): Promise<Array<ArrayBuffer>> {
            return wavToMp3(mp3Enc, xs, { kbps: 64, flush: false });
          }
          return (this.player as MSEPlayer).appendFiles(blobs, transform).then(() => this.$audio.play());
        });
    });
  }
  private internalOnComplete() {
    if (this.mp3Enc) {
      const flush = this.mp3Enc.flush();
      if (flush.length > 0 && this.player) {
        const blob = new Blob([flush]);
        this.player.appendFiles([blob]).then(() => this.$audio.play());
      }
    }
    this.internalDispose();
  }
  private internalOnError() {
    this.internalDispose();
  }
  private internalDispose(withPlayer = false) {
    this.mp3Enc = null;
    this.internalDummyPromise = null;
    if (withPlayer) {
      this.disposePlayer();
    }
  }
  private disposePlayer() {
    if (this.player && this.$audio.src) {
      try {
        URL.revokeObjectURL(this.$audio.src);
      }
      catch (e) { /* Ignore */ }
    }
    this.player = null;
  }
  destroy() {
    this.internalDispose(true);
  }
  start(option: StartOption, forceStart = false) {
    if (!forceStart && this.tts.status !== TTSStatus.idle) {
      return getResolvedPromise();
    }
    let prev$ = getResolvedPromise();
    if (forceStart) {
      // use `noop` to prevent `throw` afterwards
      if (this.tts.end) {
        prev$ = this.tts.end().catch(noop);
      }
    }
    // `finally` will return/throw the previous promise value/reason
    // so use `then`
    return prev$.then(() => {
      this.disposePlayer();
      this.player = new MSEPlayer();
      this.$audio.src = URL.createObjectURL(this.player.mediaSource);
      return this.tts.start(option);
    });
  }
  end() {
    let end$ = getResolvedPromise();
    if (this.tts.end) {
      end$ = this.tts.end();
    }
    // use `Promise#resolve` to wrap this, because the `end` may return `undefined`
    end$.finally(() => this.internalDispose());
    return end$;
  }
  // @todo
  getEstimatedDuration(text: string): number {
    return text.length / 5;
  }
  // @todo
  onAudioDurationChange(): number {
    return 0;
  }
  // @todo
  play(): void { }
  // @todo
  pause(): void { }
  // @todo
  stop(): void { }
}
