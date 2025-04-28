/**
 * Generate a JSON Schema from an OpenAPI specification file
 * For example:
 * If you want to generate a JSON Schema for the User model in the openapi-public-original.yaml file, you can run the following command:
 * npm run json-schema-generator -- --file=lib/openapi/public/openapi-public-original.yaml --model=User --output=user.csv --format=csv
 */
import fs from 'fs'
import { exit } from 'process'
import yaml from 'js-yaml'
import { Command } from 'commander'

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

const program = new Command()
program
  .requiredOption('--file <path>', 'Path to OpenAPI specification file')
  .requiredOption('--model <name>', 'Name of the model to extract')
  .requiredOption('--output <path>', 'Output file path')
  .option('--format <type>', 'Output format (json or csv)', 'json')
  .parse(process.argv)

const {
  file: filePath,
  model: modelName,
  output: outputPath,
  format,
} = program.opts()

const resolveRef = (openAPISpec: OpenAPISpec, ref: string): any => {
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

const processSchema = (openAPISpec: OpenAPISpec, schema: any): any => {
  if (!schema) {
    return schema
  }
  if (schema.$ref) {
    return processSchema(openAPISpec, resolveRef(openAPISpec, schema.$ref))
  }

  const newSchema = deepClone(schema)

  if (newSchema.properties) {
    Object.keys(newSchema.properties).forEach((propName) => {
      newSchema.properties[propName] = processSchema(
        openAPISpec,
        newSchema.properties[propName]
      )
    })
  }

  if (newSchema.items) {
    newSchema.items = processSchema(openAPISpec, newSchema.items)
  }

  ;['allOf', 'anyOf', 'oneOf'].forEach((key) => {
    if (newSchema[key]) {
      newSchema[key] = newSchema[key].map((s: any) =>
        processSchema(openAPISpec, s)
      )
    }
  })

  if (
    newSchema.additionalProperties &&
    typeof newSchema.additionalProperties === 'object'
  ) {
    newSchema.additionalProperties = processSchema(
      openAPISpec,
      newSchema.additionalProperties
    )
  }

  return newSchema
}

export const flattenOpenAPISchema = (
  openAPISpec: OpenAPISpec,
  entityName: string
): JSONSchema => {
  const entitySchema =
    openAPISpec.components?.schemas?.[entityName] ||
    openAPISpec.definitions?.[entityName]

  if (!entitySchema) {
    throw new Error(
      `Entity '${entityName}' not found in the OpenAPI specification`
    )
  }

  const flattenedSchema = processSchema(openAPISpec, entitySchema)
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    ...flattenedSchema,
  }
}

const flattenSchemaForCSV = (
  schema: any,
  prefix = '',
  maxArrayItems = 1,
  result: string[] = []
): string[] => {
  if (schema.allOf) {
    schema.allOf.forEach((subSchema: any) =>
      flattenSchemaForCSV(subSchema, prefix, maxArrayItems, result)
    )
    return result
  }

  if (schema.oneOf || schema.anyOf) {
    const variants = schema.oneOf || schema.anyOf
    if (variants.length > 0) {
      flattenSchemaForCSV(variants[0], prefix, maxArrayItems, result)
    }
    return result
  }

  if (schema.type === 'object' && schema.properties) {
    Object.entries(schema.properties).forEach(([key, prop]) => {
      const newPrefix = prefix ? `${prefix}.${key}` : key
      flattenSchemaForCSV(prop, newPrefix, maxArrayItems, result)
    })
  } else if (schema.type === 'array' && schema.items) {
    Array.from({ length: maxArrayItems }, (_, i) => {
      const arrayPrefix = `${prefix}.${i}`
      flattenSchemaForCSV(schema.items, arrayPrefix, maxArrayItems, result)
    })
  } else {
    result.push(prefix)
  }
  return result
}

const processOpenAPIFile = async (
  filePath: string,
  entityName: string,
  outputPath: string
): Promise<JSONSchema> => {
  try {
    const fileContent = await fs.promises.readFile(filePath, 'utf8')
    const spec: OpenAPISpec =
      filePath.endsWith('.yaml') || filePath.endsWith('.yml')
        ? (yaml.load(fileContent) as OpenAPISpec)
        : JSON.parse(fileContent)

    const flattenedSchema = flattenOpenAPISchema(spec, entityName)

    if (format === 'csv') {
      const headers = flattenSchemaForCSV(flattenedSchema)
      await fs.promises.writeFile(outputPath, headers.join(',') + '\n', 'utf8')
      console.log(`CSV template written to ${outputPath}`)
    } else {
      await fs.promises.writeFile(
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
