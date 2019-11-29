/*!
 * entry | bqliu
 */

import MSEPlayer from '@isfe/mse-player/src/MSEPlayer'
import pcmToWav from '@isfe/mse-player/src/pcmToWav'
import TTS from '@isfe/ai-plus-sdk/src/tts'
import wavToMp3 from './wavToMp3'

const $audio = document.querySelector('audio')

const tts = new TTS(function (base64PcmData) {
  if (base64PcmData) {
    Promise
      .all([base64PcmData].map((base64PcmData) => pcmToWav(base64ToBlob(base64PcmData, false))))
      .then((base64WavData) => {
        const blobs = base64WavData.map((x) => base64ToBlob(x))
        player.appendFiles(blobs, wavToMp3).then(() => $audio.play())
      })
  }
})

let player: MSEPlayer = null

const ttsOption = {
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
}

const $input = document.querySelector('#selector') as HTMLInputElement
const $button = document.querySelector('#button')
$button.addEventListener('click', function () {
  player = new MSEPlayer({ onError: console.log })
  $audio.src = URL.createObjectURL(player.mediaSource)
  tts.start({
    url: 'http://172.31.3.142:8087/tts/',
    // url: 'http://172.31.3.142:8087/tts_online/',
    text: $input.value,
    ttsOption
  })
})

function base64ToBlob (baseStr, isBase64 = true) {
  const data = isBase64 ? baseStr.split(',')[1] : baseStr
  const bstr = atob(data)
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  // 将二进制数据存入Uint8Array类型的数组中
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: 'wav' })
}
