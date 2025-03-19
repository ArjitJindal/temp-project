import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import yaml from 'yaml'

const PREFIX = 'Nango'

const convertFieldType = (fieldType: string): any => {
  const type = fieldType.split(' | ').filter((t) => t !== 'null')

  if (type.length === 1) {
    if (type[0] === 'string') {
      return { type: 'string' }
    }
    if (type[0] === 'number') {
      return { type: 'integer' }
    }
    if (type[0] === 'boolean') {
      return { type: 'boolean' }
    }
    if (type[0] === 'string[]') {
      return { type: 'array', items: { type: 'string' } }
    }
    if (type[0] === 'number[]') {
      return { type: 'array', items: { type: 'integer' } }
    }
    if (type[0] === 'boolean[]') {
      return { type: 'array', items: { type: 'boolean' } }
    }

    if (type[0].endsWith('[]')) {
      const baseType = type[0].slice(0, -2)
      return {
        type: 'array',
        items: {
          $ref: `#/components/schemas/${PREFIX}${baseType}`,
        },
      }
    } else {
      return { $ref: `#/components/schemas/${PREFIX}${fieldType}` }
    }
  }

  return { type: 'object', properties: {} }
}

const main = () => {
  const nangoYaml = yaml.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../nango-integrations/nango.yaml'),
      'utf8'
    )
  )

  const openapiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Nango Integrations',
      version: '1.0.0',
    },
    components: {
      schemas: {},
    },
  }

  for (const [modelName, fields] of Object.entries(nangoYaml.models)) {
    const properties: any = {}

    const required: string[] = []

    for (const [field, fieldType] of Object.entries(fields as any)) {
      const type = fieldType as string
      properties[field] = convertFieldType(type)
      if (!type.includes(' | null')) {
        required.push(field)
      }
    }

    openapiSpec.components.schemas[`${PREFIX}${modelName}`] = {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    }
  }

  const stringifiedYaml = yaml.stringify(openapiSpec)

  fs.writeFileSync(
    path.resolve(__dirname, '../lib/openapi/internal/nango-models.yaml'),
    stringifiedYaml
  )

  execSync('cd ../nango-integrations && npm run generate', { stdio: 'inherit' })
}

main()
