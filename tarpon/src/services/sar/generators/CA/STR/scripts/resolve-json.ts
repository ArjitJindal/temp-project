// Usage: ts-node src/services/sar/generators/CA/STR/scripts/resolve-json.ts
// It'll output the json schema file in resources/STRBatchSchema.type.ts and resources/STRBatchSchema_Resolved.ts

import path from 'path'
import fs from 'fs'
import $RefParser from '@apidevtools/json-schema-ref-parser'
import { compile } from 'json-schema-to-typescript'
import { FintracJsonSchema } from '../resources/STRBatchSchema'
import { agumentUiSchemaFintracStr } from '@/services/sar/utils/augmentations/manualSchemaManipulation'

async function main() {
  const jsonSchema: any = FintracJsonSchema

  jsonSchema['definitions'] = agumentUiSchemaFintracStr(
    jsonSchema['definitions']
  )

  void compile(jsonSchema, 'EFL_CTRXBatchSchema').then((ts) => {
    fs.writeFileSync(
      path.join(__dirname, '..', 'resources', 'STRBatchSchema.type.ts'),
      ts
    )
  })

  const csvData = fs.readFileSync(
    path.join(__dirname, '..', 'resources', 'str-dod-api-eng.csv'),
    'utf-8'
  )
  const rows = csvData.trim().split('\n')
  const keyIndex = 0
  const valueIndex = 1

  const titleMapping = {}
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(',')
    const key = cols[keyIndex]
    const value = cols[valueIndex]
    titleMapping[key] = value
  }

  const stringifiedJson = await resolveSchema(jsonSchema)

  fs.writeFileSync(
    path.join(__dirname, '..', 'resources', 'STRBatchSchema_Resolved.ts'),
    `export const FintracJsonSchemaResolved = ${stringifiedJson}`
  )
}

async function resolveSchema(schema: string) {
  const dereferencedSchema = await $RefParser.dereference(schema)
  return JSON.stringify(dereferencedSchema, null, 2)
}

main()
  .then(() => console.log('Execution completed'))
  .catch((e) => console.error(e))
