import fs from 'fs'
import { exit } from 'process'
import yaml from 'js-yaml'

/**
 * To generate a JSON schema from an OpenAPI spec, run the following command:
 * Usage = npm run json-schema-generator -- --file=lib/openapi/public/openapi-public-original.yaml --model=Business --output=business.json
 */

interface OpenAPISpec {
  components?: {
    schemas?: Record<string, any>
  }
  definitions?: Record<string, any>
}

interface JSONSchema {
  $schema: string
  [key: string]: any
}

const args = process.argv.slice(2)
const filePath = args.find((arg) => arg.startsWith('--file='))?.split('=')[1]
const modelName = args.find((arg) => arg.startsWith('--model='))?.split('=')[1]
const outputPath = args
  .find((arg) => arg.startsWith('--output='))
  ?.split('=')[1]

console.log(filePath, modelName, outputPath)

if (!filePath || !modelName || !outputPath) {
  console.error('Missing required arguments')
  process.exit(1)
}

const flattenOpenAPISchema = (
  openAPISpec: OpenAPISpec,
  entityName: string
): JSONSchema => {
  const resolveRef = (ref: string): any => {
    const parts = ref.replace('#/', '').split('/')
    let current: any = openAPISpec
    for (const part of parts) {
      if (current && part in current) {
        current = current[part]
      } else {
        throw new Error(`Invalid reference: ${ref}`)
      }
    }
    return current
  }

  const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))

  const processSchema = (schema: any): any => {
    if (!schema) {
      return schema
    }

    if (schema.$ref) {
      const resolved = resolveRef(schema.$ref)
      return processSchema(resolved)
    }

    const newSchema = deepClone(schema)

    if (newSchema.properties) {
      Object.keys(newSchema.properties).forEach((propName) => {
        newSchema.properties[propName] = processSchema(
          newSchema.properties[propName]
        )
      })
    }

    if (newSchema.items) {
      newSchema.items = processSchema(newSchema.items)
    }

    ;['allOf', 'anyOf', 'oneOf'].forEach((key) => {
      if (newSchema[key]) {
        newSchema[key] = newSchema[key].map(processSchema)
      }
    })

    if (
      newSchema.additionalProperties &&
      typeof newSchema.additionalProperties === 'object'
    ) {
      newSchema.additionalProperties = processSchema(
        newSchema.additionalProperties
      )
    }

    return newSchema
  }

  try {
    const entitySchema: any =
      openAPISpec.components?.schemas?.[entityName] ||
      openAPISpec.definitions?.[entityName]
    if (!entitySchema) {
      throw new Error(
        `Entity '${entityName}' not found in the OpenAPI specification`
      )
    }

    const flattenedSchema = processSchema(entitySchema)

    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      ...flattenedSchema,
    }
  } catch (error: any) {
    throw new Error(`Error flattening schema: ${error.message}`)
  }
}

const processOpenAPIFile = async (
  filePath: string,
  entityName: string,
  outputPath?: string
): Promise<JSONSchema> => {
  try {
    const fileContent = await fs.promises.readFile(filePath, 'utf8')
    const spec: OpenAPISpec =
      filePath.endsWith('.yaml') || filePath.endsWith('.yml')
        ? (yaml.load(fileContent) as OpenAPISpec)
        : JSON.parse(fileContent)

    const flattenedSchema = flattenOpenAPISchema(spec, entityName)

    if (outputPath) {
      fs.writeFileSync(
        outputPath,
        JSON.stringify(flattenedSchema, null, 2),
        'utf8'
      )
      console.log(`Flattened schema written to ${outputPath}`)
    }

    return flattenedSchema
  } catch (error: any) {
    console.error(`Error processing OpenAPI file: ${error.message}`)
    throw error
  }
}

processOpenAPIFile(filePath, modelName, outputPath)
  .then(() => {
    console.log('Done')
    exit(0)
  })
  .catch((error) => {
    console.error(error)
    exit(1)
  })
