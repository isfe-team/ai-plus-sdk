import rollupTypescript from 'rollup-plugin-typescript'
import { uglify as rollupUglify } from 'rollup-plugin-uglify'
import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'

const inputs = [
  ['src/index.ts', 'AIPlus'],
  ['src/tts/index.ts', 'TTS'],
  ['src/tts/TTSWithPlayer.ts', 'TTSWithPlayer']
  ['src/iat/index.ts', 'IAT']
]

const formats = [
  'esm',
  'umd'
]

function genConfigs () {
  return inputs.reduce((acc, [input, name]) => [...acc, ...formats.reduce((acc, format) => {
    const config = {
      input,
      plugins: [nodeResolve(), commonjs(), rollupTypescript()],
      external: ['js-base64', 'lamejs', '@isfe/mse-player'],
      output: {
        name,
        format,
        sourcemap: true,
        file: `dist/${name.toLowerCase()}/${name}.${format}.js`
      },
      onwarn (warning) {
        if (warning.loc && warning.loc.file.indexOf('node_modules') === -1 && warning.code === 'EVAL') {
          return
        }
      }
    }

    const configs = [...acc, config]
    // `uglifyjs` doesn't support es6
    // `esm` format will generate `export default`
    if (format !== 'esm') {
      const compactConfig = {
        ...config,
        plugins: [...config.plugins, rollupUglify()],
        output: { ...config.output, file: `dist/${name.toLowerCase()}/${name}.${format}.min.js` }
      }
      configs.push(compactConfig)
    }

    return configs
  }, [])], [])
}

const configs = genConfigs()

export default configs
