const { rollup } = require('rollup')
const kebabcase = require('lodash.kebabcase')
const uglify = require('uglify-js')
const {
  banner,
  write,
} = require('./utils')

async function run ({
  input,
  output,
  outdir,
  format,
  compress,
  plugins,
  name,
  moduleName,
  exports,
  external,
  globals,
  ctx,
}) {
  try {
    // we keep passing down the ctx down to rollup plugins
    const bundle = await rollupBundle({
      input,
      plugins,
      format,
      outdir,
      name,
      compress,
      ctx,
      external,
    })
    // TODO handle errors
    let { code } = await bundle.generate({
      banner,
      exports,
      globals,
      format,
      name: moduleName,
    })

    if (compress) {
      code = uglify.minify(
        code, {
          output: {
            preamble: banner,
            ascii_only: true, // eslint-disable-line camelcase
          },
        }
      ).code
    }

    return write(output, code)
  } catch (err) {
    throw err
    // console.log('ERROR', err)
  }
}

function rollupBundle ({
  format,
  outdir,
  name,
  compress,
  ctx,
  plugins,
  ...config
}) {
  config.plugins = Object.keys(plugins)
    .filter(plugin => plugins[plugin])
    .map(plugin => {
      let opts = plugins[plugin]
      if (typeof opts === 'function') {
        opts = opts({
          format,
          outdir,
          name,
          compress,
          ctx,
        })
      }
      return require(`rollup-plugin-${kebabcase(plugin)}`)(opts === true ? undefined : opts)
    })

  return rollup(config)
}

module.exports = run
