const uppercamelcase = require('uppercamelcase')
const findRoot = require('find-root')
const fs = require('fs')
const { pwd } = require('shelljs')
const { join } = require('path')

const cwd = pwd().toString()
const root = findRoot(cwd)
const { author: _author, name, version, contributors: _contributors } = require(join(root, 'package.json'))

const contributors = _contributors && _contributors.map(c => c.replace(/\s+<.*/, '')).join(', ')
const author = _author.replace(/\s+<.*/, '')

function generateBanner (useContributors) {
  const creator = author || contributors
  return `/**
 * ${name} v${version}
 * (c) ${new Date().getFullYear()} ${(useContributors ? contributors : author) || creator}
 * @license MIT
 */
`
}

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
  version,
  write,
  getSize,
  generateBanner,
}
