const fs = require("fs-extra");
const yaml = require('yaml')
const path = require('path')

const PROJECT_DIR = path.resolve(__dirname, '..', '..');

const formatOptions = {
  defaultKeyType: 'PLAIN',
  defaultStringType: 'PLAIN',
  singleQuote: true,
  lineWidth: 80,
}

function stringify(obj) {
  return yaml.stringify(obj, formatOptions)
}

function parse(obj) {
  return yaml.parse(obj)
}

function reformat(text) {
  return stringify(parse(text))
}

async function reformatFile(file) {
  const text = (await fs.readFileSync(file)).toString()
  await fs.writeFile(file, reformat(text))
}

module.exports = {
  PROJECT_DIR,
  stringify,
  parse,
  reformat,
  reformatFile,
}
