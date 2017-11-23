const uppercamelcase = require('uppercamelcase')
const findRoot = require('find-root')
const fs = require('fs')
const { pwd } = require('shelljs')
const { join } = require('path')

const cwd = pwd().toString()
const root = findRoot(cwd)
const { author: _author, name, version } = require(join(root, 'package.json'))
const author = _author.replace(/\s+<.*/, '')

// TODO use actual License
const banner = `/**
 * ${name} v${version}
 * (c) ${new Date().getFullYear()} ${author}
 * @license MIT
 */
`

function write (dest, code) {
  return new Promise((resolve, reject) => {
    fs.writeFile(dest, code, err => {
      if (err) return reject(err)
      resolve(code)
    })
  })
}

function getSize (code) {
  return (code.length / 1024).toFixed(2) + 'kb'
}

module.exports = {
  author,
  name,
  moduleName: uppercamelcase(name),
  banner,
  version,
  write,
  getSize,
}
