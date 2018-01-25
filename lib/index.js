const { rollup, watch } = require('rollup')
const kebabcase = require('lodash.kebabcase')
const uglify = require('uglify-js')
const Observable = require('zen-observable')
const {
  generateBanner,
  write,
} = require('./utils')

async function runWatcher ({
  compress,
  outdir,
  ctx,
  output,
  name,
  moduleName,
  plugins,
  format,
  ...opts
}) {
  opts.plugins = resolvePlugins({ compress, outdir, ctx, format, plugins, name })
  opts.output = {
    file: output,
    format,
    name: moduleName,
  }
  const watcher = watch(opts)

  return new Observable(observer => {
    watcher.on('event', ({ code, ...event }) => {
      if (code === 'START') {
        observer.next('START')
      } else if (code === 'BUNDLE_START') {
        observer.next('BUNDLE_START')
      } else {
        observer.next(code)
      }
    })
  })
}

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
  useContributors,
}) {
  const banner = generateBanner(useContributors)
  try {
    // we keep passing down the ctx down to rollup plugins
    plugins = resolvePlugins(arguments[0])
    const bundle = await rollup({
      input,
      plugins,
      format,
      name,
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

function resolvePlugins ({
  format,
  outdir,
  name,
  compress,
  ctx,
  plugins,
}) {
  return Object.keys(plugins)
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
}

module.exports = { run, runWatcher }
