function minifyCss (css) {
  // load them here because it takes a lot to load and may be unnecessary
  // for js only
  const postcss = require('postcss')
  const cssnano = require('cssnano')
  return postcss([cssnano]).process(css)
}

module.exports = {
  minifyCss,
}
