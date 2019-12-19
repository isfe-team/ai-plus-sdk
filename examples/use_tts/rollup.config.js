import rollupTypescript from 'rollup-plugin-typescript'
import { uglify as rollupUglify } from 'rollup-plugin-uglify'
import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import externalGlobals from 'rollup-plugin-external-globals'

const inputs = [
  ['src/index.ts', 'main']
]

const formats = [
  'esm'
]

function genConfigs () {
  return inputs.reduce((acc, [input, name]) => [...acc, ...formats.reduce((acc, format) => {
    const config = {
      input,
      plugins: [nodeResolve(), commonjs(), rollupTypescript(), externalGlobals({ lamejs: 'lamejs' })],
      output: {
        name,
        format,
        sourcemap: true,
        file: `./${name}.${format}.js`
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
        output: { ...config.output, file: `${name}.${format}.min.js` }
      }
      configs.push(compactConfig)
    }

    return configs
  }, [])], [])
}

const configs = genConfigs()

export default configs
