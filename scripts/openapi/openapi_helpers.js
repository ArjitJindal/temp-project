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

async function localizeRefs(tree) {
  async function localizeRef(ref) {
    const match = ref.match(/^(.*\.yaml)#(.*)$/)
    if (!match) {
      return ref;
    }
    const [_, file, path] = match

    // todo: parse referenced file and resolve model by path
    return `#${path}`
  }

  async function traverse(tree) {
    if (tree == null) {
      return tree;
    }
    if (Array.isArray(tree)) {
      return Promise.all(tree.map(traverse))
    }
    if (typeof tree === 'object') {
      const result = {}
      for (const [key, value] of Object.entries(tree)) {
        if (key === '$ref' && typeof value === 'string') {
          result[key] = await localizeRef(value)
        } else {
          result[key] = await traverse(value)
        }
      }
      return result;
    }
    return tree;
  }

  return await traverse(tree)
}

module.exports = {
  PROJECT_DIR,
  stringify,
  parse,
  reformat,
  reformatFile,
  localizeRefs,
}
