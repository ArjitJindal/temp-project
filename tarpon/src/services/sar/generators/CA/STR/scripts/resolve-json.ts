// Usage: ts-node src/services/sar/generators/CA/STR/scripts/resolve-json.ts
// It'll output the json schema file in resources/STRBatchSchema.type.ts and resources/STRBatchSchema_Resolved.ts

import path from 'path'
import fs from 'fs'
import $RefParser from '@apidevtools/json-schema-ref-parser'
import { compile } from 'json-schema-to-typescript'
import { parse } from 'csv-parse'
import { FintracJsonSchema } from '../resources/STRBatchSchema'
import { agumentUiSchemaFintracStr } from '@/services/sar/utils/augmentations/manualSchemaManipulation'

async function main() {
  const jsonSchema: any = FintracJsonSchema

  // csv file is present in dev s3 s3://tarpon-document-dev-eu-central-1/str-dod-api-eng.csv
  const csvData = fs.readFileSync(
    path.join(__dirname, '..', 'resources', 'str-dod-api-eng.csv'),
    'utf-8'
  )

  // Parse CSV properly using csv-parse library
  const records = parse(csvData, {
    columns: true, // Use first row as column headers
    skip_empty_lines: true,
    delimiter: ',',
    quote: '"',
    escape: '"',
    trim: true,
  })

  const titleMapping = {}

  // Process each record using column names instead of indices
  await records.forEach((row) => {
    const key = row['Field Id']
    const value = row['Field name']
    const description = row['UI Description']

    if (key && value && description) {
      titleMapping[key] = { value, description }
    }
  })

  jsonSchema['definitions'] = agumentUiSchemaFintracStr(
    jsonSchema['definitions']
  )

  jsonSchema['properties'] = agumentUiSchemaFintracStr(jsonSchema['properties'])

  void compile(jsonSchema, 'EFL_CTRXBatchSchema').then((ts) => {
    fs.writeFileSync(
      path.join(__dirname, '..', 'resources', 'STRBatchSchema.type.ts'),
      ts
    )
  })

  populateTitleInSchema(jsonSchema, titleMapping, 'str')

  const stringifiedJson = await resolveSchema(jsonSchema)

  fs.writeFileSync(
    path.join(__dirname, '..', 'resources', 'STRBatchSchema_Resolved.ts'),
    `export const FintracJsonSchemaResolved = ${stringifiedJson}`
  )
}

function populateTitleInSchema(
  schema: string,
  titleMapping: object,
  key: string
) {
  if (!schema) {
    return
  }
  if (schema['type'] === 'object' && schema['properties']) {
    Object.keys(schema['properties']).forEach((k) => {
      const newKey = key + '.' + k
      if (titleMapping[newKey]) {
        schema['properties'][k]['title'] = titleMapping[newKey].value
        schema['properties'][k]['description'] =
          titleMapping[newKey].description
      }
      populateTitleInSchema(schema['properties'][k], titleMapping, newKey)
    })
  } else if (
    schema['type'] === 'array' &&
    schema['items'] &&
    schema['items']['properties']
  ) {
    Object.keys(schema['items']['properties']).forEach((k) => {
      const tempk = k.slice(0, k.length - 1)
      const newKey = key + '.' + tempk
      if (titleMapping[newKey]) {
        schema['properties'][k]['title'] = titleMapping[newKey].value
        schema['properties'][k]['description'] =
          titleMapping[newKey].description
      }
      populateTitleInSchema(
        schema['items']['properties'][k],
        titleMapping,
        newKey
      )
    })
  }
}

async function resolveSchema(schema: string) {
  const dereferencedSchema = await $RefParser.dereference(schema)
  return JSON.stringify(dereferencedSchema, null, 2)
}

main()
  .then(() => console.log('Execution completed'))
  .catch((e) => console.error(e))
