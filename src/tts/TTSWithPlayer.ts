import MSEPlayer from '@isfe/mse-player/src/MSEPlayer'
import pcmToWav from '@isfe/mse-player/src/pcmToWav'
import TTS, { TTSOption } from '.'
import { Base64 } from 'js-base64'
import { resolve } from 'dns'

const tts = new TTS(processPCMBase64Data)
let player: MSEPlayer

interface audioParam {
  src: string;
  [key: string]: any
}

interface startTTSParam {
  url: string;
  text: string;
  ttsOption: TTSOption
  $audio: audioParam
}

interface Transformer {
  (buffers: Array<ArrayBuffer>): Array<ArrayBuffer> | Promise<Array<ArrayBuffer>>;
}

let wavToMp3Promise: Transformer

let $audio: any

function base64ToBlob (baseStr: string) {
  const bstr = Base64.atob(baseStr)
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  // 将二进制数据存入Uint8Array类型的数组中
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: 'wav' })
}

// let resoveData: string

function processPCMBase64Data(data: string) {
  if (data) {
    Promise.all([data].map((blob) => {
      return pcmToWav(base64ToBlob(blob))
    })).then((base64Array) => {
      const blobs = base64Array.map((x) => base64ToBlob(x.split(',')[1]))
      player.appendFiles(blobs, wavToMp3Promise).then(() => $audio.play())
    })
  }
}

export default class TTSPlay {
  constructor () {
  }
  stop () {
    tts.stop()
  }
  playAudio (startTTSParam: startTTSParam, wavToMp3: Transformer) {
    player = new MSEPlayer({ onError: console.log })
    startTTSParam.$audio.src = URL.createObjectURL(player.mediaSource)
    wavToMp3Promise = wavToMp3
    $audio = startTTSParam.$audio
    tts.start(startTTSParam)
  }
}
