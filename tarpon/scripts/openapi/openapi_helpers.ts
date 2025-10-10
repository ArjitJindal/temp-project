import fs from 'fs'
import path from 'path'
import yaml, {
  CreateNodeOptions,
  DocumentOptions,
  ParseOptions,
  SchemaOptions,
  ToStringOptions,
} from 'yaml'

const PROJECT_DIR = path.resolve(__dirname, '..', '..')

type FormatOptions = DocumentOptions &
  SchemaOptions &
  ParseOptions &
  CreateNodeOptions &
  ToStringOptions

const formatOptions: FormatOptions = {
  defaultKeyType: 'PLAIN',
  defaultStringType: 'PLAIN',
  singleQuote: true,
  lineWidth: 80,
}

function stringify(obj: any) {
  return yaml.stringify(obj, formatOptions)
}

function parse(obj: string) {
  return yaml.parse(obj)
}

function reformat(text: string) {
  return stringify(parse(text))
}

async function reformatFile(file) {
  const text = fs.readFileSync(file).toString()
  fs.writeFile(file, reformat(text), (err: any) => {
    if (err) {
      console.error(err)
    }
  })
}

async function localizeRefs(tree) {
  async function localizeRef(ref) {
    const match = ref.match(/^(.*\.yaml)#(.*)$/)
    if (!match) {
      return ref
    }
    const [_, _file, path] = match

    // todo: parse referenced file and resolve model by path
    return `#${path}`
  }

  async function traverse(tree) {
    if (tree == null) {
      return tree
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
      return result
    }
    return tree
  }

  return await traverse(tree)
}

export { reformatFile, localizeRefs, stringify, parse, reformat, PROJECT_DIR }
