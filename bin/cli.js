#!/usr/bin/env node

require('pretty-exceptions')
const pad = require('pad-left')
const writePkg = require('write-pkg')
const readPkg = require('read-pkg')
const isCI = require('is-ci')
const Listr = require('listr')
const pify = require('pify')
const cosmiconfig = require('cosmiconfig')
const kebabcase = require('lodash.kebabcase')
const mkdirp = require('mkdirp')
const yargs = require('yargs')
const chalk = require('chalk')
const { run, runWatcher } = require('../lib')
const { basename } = require('path')
const fs = require('fs')
const zlib = require('zlib')
const { getSize, version, moduleName, cwd, packagePath } = require('../lib/utils')
const {
  minifyCss,
} = require('../lib/styles')

const argv = yargs
    .command('*', 'bundle your lib', () => {}, argv => {
        if (argv._.length) argv.input = argv._.shift()
      })
      .usage('Usage: $0 <file> [options]')
      .example('$0 src/index.js', 'bundles cjs, es, umd, and minified umd versions of your lib')
      .option('format', {
        describe: 'format(s) you want to bundle your lib for',
        alias: ['f', 'formats'],
        choices: ['es', 'umd', 'cjs', 'amd', 'iife'],
        default: ['es', 'umd', 'cjs'],
        array: true,
      })
      .option('compress', {
        describe: 'generate a compressed version of a bundle as well',
        alias: 'c',
        choices: ['es', 'umd', 'cjs'],
        default: ['umd'],
        array: true
      })
      .option('outdir', {
        describe: 'directory where files are created',
        alias: 'o',
        type: 'string',
        default: 'dist',
      })
      .option('moduleName', {
        describe: 'global name of your module. Default to a PascalCase version of the package name',
        alias: 'n',
        type: 'string',
        default: moduleName,
      })
      .option('exports', {
        describe: 'type of exports your module does',
        alias: 'e',
        choices: ['auto', 'named', 'default'],
        type: 'string',
        default: 'auto',
      })
      .option('externals', {
        describe: 'declare external libs',
        alias: ['external'],
        array: true,
      })
      .option('global', {
        describe: 'declare global dependencies in the form of moduleId:global, ex: jquery:$',
        alias: ['globals'],
        array: true,
        coerce (globals) {
          return globals.reduce((o, global) => {
            const [id, gl] = global.split(':')
            o[id] = gl || id
            return o
          }, {})
        },
      })
      .option('verbose', {
        describe: 'use a more verbose and static output. Activated by default on CI systems',
        alias: 'v',
        default: isCI,
      })
      .option('watch', {
        describe: 'launch rollup in watch mode',
        alias: 'w',
      })
      .option('use-contributors', {
        describe: 'use contributors instead of author field from package.json',
        default: true,
      })
      .option('plugins', {
        alias: ['p', 'plugin'],
        describe: 'add plugins to the rollup config',
        array: true,
        default: [],
      })
      .help('h')
      .alias('h', 'help')
      .epilog('copyright 2017')
      .argv

const basePlugins = {
  replace: {
    __VERSION__: version,
    'process.env.NODE_ENV': '"development"',
  },
  flow: false,
  nodeResolve: {
    extensions: ['.js', '.vue', '.jsx', '.json'],
  },
  vue ({ format, name, outdir, compress, ctx }) {
    const css = ctx.isCssHandled ? false : function (css, styles) {
      if (!styles.length) return
      ctx.css = css
      // ctx.styles = Promise.all(styles.map(style => compile(style, {})))
    }
    ctx.isCssHandled = true

    return {
      compileTemplate: true,
      css,
    }
  },
  buble: {
    jsx: 'h',
    objectAssign: 'Object.assign',
    transforms: {
      dangerousForOf: true,
    },
  },
  commonjs: true,
}

const DEFAULTS = {
  input: 'src/index.js',
  plugins: basePlugins,

  // custom options
  file: ({ outdir, name, format, compress}) =>
    `${outdir}/${name}${format !== 'umd' ? '.' + format : ''}${compress ? '.min' : ''}.js`,
  'umd.min': {
    plugins: {
      replace: {
        __VERSION__: version,
        'process.env.NODE_ENV': '"production"',
      },
    },
  },
}

function generateRunOpts(format, opts) {
  const {
    outdir,
    compress,
    name,
    exports,
    plugins: basePlugins,
    file: baseFile,
  } = opts
  // TODO merge basePlugins
  const formatOpts = opts[format + (compress ? '.min' : '')] || {}
  const { plugins } = formatOpts
  const file = formatOpts.file || baseFile

  return {
    ...opts,
    output: file({
      outdir,
      name,
      format,
      compress,
    }),
    format,
    plugins: Object.assign({}, basePlugins, plugins),
  }
}

function generateTask (opts, { format, compress }) {
  const runOpts = generateRunOpts(format, { ...opts, compress })
  return {
    title: `Waiting - ${runOpts.output}`,
    task: async (ctx, task) => {
      // we pass down the context so we can get CSS and build it later
      if (opts.watch) {
        // rollup uses that option
        delete runOpts.watch
        task.title = `Watching - ${runOpts.output}`
        return runWatcher({ ...runOpts, ctx })
      }
      task.title = `Bundling - ${runOpts.output}`
      const code = await run({ ...runOpts, ctx })
      task.title = `${runOpts.output} ${chalk.bold.magenta(getSize(code))}`
      if (compress) {
        task.title += ` (gzipped: ${chalk.bold.magenta(getSize(await pify(zlib.gzip)(code)))})`
      }

      return code
    }
  }
}

// TODO trasform compress into object association?

async function main () {
  // TODO check file exist
  // TODO merge plugins options
  // XXX cosmiconfig not working, I must be doing something wrong
  const { config } = cosmiconfig('rollit', { sync: true }).load(cwd) || { config: {} }
  // console.log('config', config)
  argv.plugins = Object.assign(
    {},
    DEFAULTS.plugins,
    config.plugins,
    argv.plugins.reduce((o, plugin) => {
      o[plugin] = true
      return o
    }, {}),
  )
  // console.log('argv', argv.plugins)
  const opts = Object.assign({}, DEFAULTS, config, argv)
  opts.name = kebabcase(opts.moduleName)

  // console.log('opts', opts)
  // TODO do checks with assertions (input exist, package.json is right)
  mkdirp(opts.outdir)
  const jsTasks = new Listr(
    [].concat(
      opts.formats.map(format => ({ compress: false, format })),
      opts.compress
        // only keep compressed version of formats we're bundling
        .filter(format => opts.formats.indexOf(format) > -1)
        .map(format => ({ compress: true, format })),
    ).map(generateTask.bind(null, opts)),
    { concurrent: true },
  )

  const tasks = new Listr([
    {
      title: 'Package.json',
      task: async () => {
        const packageData = await readPkg(packagePath)
        const fields = {
          main: 'cjs',
          module: 'es',
          unpkg: 'umd',
          browser: 'es',
        }
        // TODO move to function
        const distFiles = opts.formats.map(format => ({ compress: false, format }))
              .reduce((t, target) => {
                t[target.format] = opts.file({
                  ...target,
                  name: opts.name,
                  outdir: opts.outdir,
                })
                return t
              }, {})
        Object.keys(fields).forEach(field => {
          packageData[field] = distFiles[fields[field]]
        })
        // not sure why there is that
        delete packageData._id
        delete packageData.readme
        await writePkg(packagePath, packageData)
      }
    },
    {
      title: 'Bundle JS',
      task: () => jsTasks,
    },
    {
      title: 'Bundle CSS',
      enabled: ctx => ctx.css,
      task: () => new Listr([
        {
          title: 'Compile CSS',
          task: async (ctx, task) => {
            // TODO useful to split original css or to have
            // an original version in scss or stylus
            // const compiledStyles = await ctx.styles
            const { name, outdir } = opts
            const file = `${outdir}/${name}.css`

            task.title = `Compiling - ${file}`
            // const css = compiledStyles.map(s => s.code.trim()).join('')
            // ctx.css = css
            await pify(fs.writeFile)(
              file,
              ctx.css.trim(),
            )
            task.title = `${file} ${chalk.bold.magenta(getSize(ctx.css))}`
          },
        },
        {
          title: 'Minify CSS',
          task: async (ctx, task) => {
            const { name, outdir } = opts
            const file = `${outdir}/${name}.min.css`

            task.title = `Minifying - ${file}`
            // TODO maps
            const { css } = await minifyCss(ctx.css)
            await pify(fs.writeFile)(
              file,
              css,
            )
            task.title = `${file} ${chalk.bold.magenta(getSize(css))}`
          },
        },
      ], { collapse: false }),
    },
  ], {
    renderer: opts.verbose ? 'verbose' : 'auto',
    collapse: false,
  })

  return tasks.run().catch(async err => {
    // console.error(err)
    // process.emit('uncaughtException', err)
    await handleError(err)
    process.exit(1)
  })
}

async function handleError (err) {
  if (err instanceof SyntaxError && 'pos' in err && err.loc && err.id) {
    console.log(chalk.bold.red('\nIt looks like rollup found a SyntaxError'))
    await displayError(err)
  }
  // Remove buble errors as we already displayed it
  delete err.snippet
  delete err.frame
  process.emit('uncaughtException', err)
}

async function displayError (err) {
  let src
  src = await pify(fs.readFile)(err.id)
  src = src.toString().split('\n')
  const start = Math.max(0, err.loc.line - 3)
  const end = Math.min(src.length, err.loc.line + 2)
  let padding = end.toString().length
  src = src
    .slice(start, end)
    .map((s, i) => {
      const lineNumberFn = i === 2
            ? chalk.white.bold
            : chalk.gray
      const lineFn = i === 2
            ? chalk.white.bold
            : chalk.white
      return lineNumberFn(pad(start + i, padding, ' ') + ':') + lineFn(s)
    })
  // sometimes raisedAt is undefined
  err.raisedAt = err.raisedAt || (err.pos + 1)
  src.splice(
    3, 0, Array(err.loc.column + 2 + padding).join(' ') +
      chalk.bold.red(Array(err.raisedAt - err.pos + 1).join('^'))
  )
  console.log('\n' + src.join('\n') + '\n')
}

main().catch(handleError)
