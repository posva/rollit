const { rollup } = require('rollup')
const kebabcase = require('lodash.kebabcase')
const uglify = require('uglify-js')
const {
  banner,
  write,
  moduleName,
} = require('./utils')

async function run ({
  input,
  output,
  format,
  compress,
  plugins,
}) {
  try {
    const bundle = await rollupBundle({ input, plugins })
    // TODO handle errors
    let { code } = await bundle.generate({
      banner,
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

function rollupBundle ({ input, plugins }) {
  const config = {
    input,
  }
  config.plugins = Object.keys(plugins)
    .filter(plugin => plugins[plugin])
    .map(plugin => {
      const opts = plugins[plugin]
      return require(`rollup-plugin-${kebabcase(plugin)}`)(opts === true ? undefined : opts)
    })
  return rollup(config)
}

module.exports = run
