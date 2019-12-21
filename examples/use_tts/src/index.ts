/*!
 * entry | bqliu
 */

import TTSWithPlayer from '@isfe/ai-plus-sdk/src/tts/TTSWithPlayer'
import { TTSOption } from '@isfe/ai-plus-sdk/src/tts'

const $audio = document.querySelector('audio') as HTMLAudioElement

const tts = new TTSWithPlayer($audio)

const $input = document.querySelector('#selector') as HTMLInputElement
const $button = document.querySelector('#button') as HTMLButtonElement
$button.addEventListener('click', function () {
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
  }, true)
})
