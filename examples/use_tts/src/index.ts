/*!
 * entry | bqliu
 */

import MSEPlayer from '@isfe/mse-player/src/MSEPlayer'
import pcmToWav from '@isfe/mse-player/src/pcmToWav'
import base64ToWavBlob from '@isfe/mse-player/src/base64ToWavBlob'
import wavToMp3 from '@isfe/mse-player/src/wavToMp3'
import strToBase64 from '@isfe/mse-player/src/strToBase64'
import TTS, { TTSOption } from '@isfe/ai-plus-sdk/src/tts'

const $audio = document.querySelector('audio') as HTMLAudioElement

const tts = new TTS(function (base64PcmData: string) {
  if (base64PcmData) {
    Promise
      .all([base64PcmData].map((base64PcmData) => pcmToWav(strToBase64(base64PcmData))))
      .then((base64WavData) => {
        const blobs = base64WavData.map((x) => base64ToWavBlob(x))
        ;(player as MSEPlayer).appendFiles(blobs, wavToMp3).then(() => $audio.play())
      })
  }
})

let player: MSEPlayer | null = null

const $param = document.querySelector('#param') as HTMLTextAreaElement
const $extendParam = document.querySelector('#extend_param') as HTMLTextAreaElement

const param = JSON.parse($param.value)
const extendParam = $extendParam.value

const ttsOption = { ...param, extend_params: extendParam } as TTSOption

const $input = document.querySelector('#selector') as HTMLInputElement
const $button = document.querySelector('#button') as HTMLButtonElement
$button.addEventListener('click', function () {
  player = new MSEPlayer({ onError: console.log })
  $audio.src = URL.createObjectURL(player.mediaSource)
  tts.start({
    url: 'http://172.31.100.214:8444/tts/', // 'http://172.31.3.142:8087/tts/' 'http://172.31.3.142:8087/tts_online/',
    text: $input.value,
    ttsOption
  })
})
