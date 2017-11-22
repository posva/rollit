#!/usr/bin/env node

const Listr = require('listr')
const cosmiconfig = require('cosmiconfig')
const yargs = require('yargs')
const chalk = require('chalk')
const run = require('../lib')
const { getSize, name, version } = require('../lib/utils')

const argv = yargs
    .command('*', 'bundle your lib', () => {}, argv => {
        if (argv._.length) argv.input = argv._.shift()
      })
      .usage('Usage: $0 <file> [options]')
      .example('$0 src/index.js', 'bundles cjs, es, umd, and minified umd versions of your lib')
      .option('format', {
        describe: 'format(s) you want to bundle your lib for',
        alias: ['f', 'formats'],
        choices: ['es', 'umd', 'cjs'],
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
        default: 'dist',
      })
      .help('h')
      .alias('h', 'help')
      .epilog('copyright 2017')
      .argv

const basePlugins = {
  nodeResolve: true,
  commonjs: true,
  vue: {
    compileTemplate: true,
    css: false,
  },
  replace: {
    __VERSION__: version,
  },
  buble: {
    jsx: 'h',
  },
}

const DEFAULTS = {
  input: 'src/index.js',
  plugins: basePlugins,
  file: ({ outdir, name, format, compress}) =>
    `${outdir}/${name}.${format}${compress ? '.min' : ''}.js`,
  umd: {
    plugins: {
      replace: {
        __VERSION__: version,
        'process.env.NODE_ENV': '"development"',
      },
    },
  },
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
  const { input, outdir, compress, plugins: basePlugins, file: baseFile } = opts
  // TODO merge basePlugins
  const formatOpts = opts[format] || {}
  const { plugins } = formatOpts
  const file = formatOpts.file || baseFile

  return {
    input,
    output: file({
      outdir,
      name,
      format,
      compress,
    }),
    format,
    compress,
    plugins: Object.assign({}, basePlugins, plugins),
  }
}

function generateTask (opts, { format, compress }) {
  const runOpts = generateRunOpts(format, { ...opts, compress })
  return {
    title: `Waiting - ${runOpts.output}`,
    task: async (_, task) => {
      task.title = `Bundling - ${runOpts.output}`
      const code = await run(runOpts)
      task.title = `${runOpts.output} ${chalk.bold.magenta(getSize(code))}`

      return code
    }
  }
}

// TODO trasform compress into object association?

async function main () {
  // TODO check file exist
  // TODO merge plugins options
  // XXX cosmiconfig not working, I must be doing something wrong
  const { config } = cosmiconfig('rollit', { sync: true }).load() || {}
  // console.log('config', config)
  // console.log('argv', argv)
  const opts = Object.assign({}, DEFAULTS, config, argv)

  // console.log('opts', opts)
  // TODO do checks with assertions
  const tasks = new Listr(
    [].concat(
      opts.formats.map(format => ({ compress: false, format })),
      opts.compress
        .filter(format => opts.formats.indexOf(format) > -1)
        .map(format => ({ compress: true, format })),
    ).map(generateTask.bind(null, opts)),
    { concurrent: true },
  )
  return tasks.run().catch(err => {
    console.error(err)
  })
}

main()
