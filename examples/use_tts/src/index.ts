/*!
 * entry | bqliu
 */

import MSEPlayer from '@isfe/mse-player/src/MSEPlayer'
import pcmToWav from '@isfe/mse-player/src/helpers/pcmToWav'
import base64ToWavBlob from '@isfe/mse-player/src/helpers/base64ToWavBlob'
import wavToMp3 from '@isfe/mse-player/src/helpers/wavToMp3'
import base64WithoutPrefixToBlob from '@isfe/mse-player/src/helpers/base64WithoutPrefixToBlob'
import TTS, { TTSOption } from '@isfe/ai-plus-sdk/src/tts'
import lamejs from 'lamejs'

const $audio = document.querySelector('audio') as HTMLAudioElement

let lastAppend$ = Promise.resolve()

// lamejs.Mp3Encoder
let mp3Enc: any = null

const tts = new TTS(function (base64PcmData: string) {
  // base64 pcm -> pcm blob -> wav blob -> mp3 ArrayBuffer
  if (!base64PcmData) {
    return
  }
  // 依序
  lastAppend$.then(() => Promise
    .all([base64PcmData].map((base64PcmData) => pcmToWav(base64WithoutPrefixToBlob(base64PcmData))))
    .then((base64WavData) => {
      const blobs = base64WavData.map((x) => base64ToWavBlob(x))

      function transform (xs: Array<ArrayBuffer>): Promise<Array<ArrayBuffer>> {
        if (!mp3Enc) {
          mp3Enc = new lamejs.Mp3Encoder(1, 16000, 64)
        }
        return wavToMp3(mp3Enc, xs, { kbps: 64, flush: false })
      }

      return (player as MSEPlayer).appendFiles(blobs, transform).then(() => $audio.play())
    })
  )
}, function () {
  if (mp3Enc) {
    const flush = mp3Enc.flush()
    if (flush.length > 0) {
      const blob = new Blob([flush])
      ;(player as MSEPlayer).appendFiles([blob]).then(() => $audio.play())
    }
  }
  mp3Enc = null
}, function () {
  console.log()
  mp3Enc = null
})

let player: MSEPlayer | null = null

const $input = document.querySelector('#selector') as HTMLInputElement
const $button = document.querySelector('#button') as HTMLButtonElement
$button.addEventListener('click', function () {
  player = new MSEPlayer({ onError: console.log })
  $audio.src = URL.createObjectURL(player.mediaSource)

  const $param = document.querySelector('#param') as HTMLTextAreaElement
  const $extendParam = document.querySelector('#extend_param') as HTMLTextAreaElement

  const param = JSON.parse($param.value)
  const extendParam = $extendParam.value

  // 拿到并组装参数
  const ttsOption = { ...param, extend_params: extendParam } as TTSOption

  tts.start({
    url: '/tts', // 'http://172.31.100.214:8444/tts/', // 'http://172.31.3.142:8087/tts/' 'http://172.31.3.142:8087/tts_online/',
    text: $input.value,
    ttsOption
  })
})
