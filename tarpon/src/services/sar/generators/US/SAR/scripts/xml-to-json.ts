// Usage: ts-node US/SAR/scripts/xml-to-json.ts
// It'll output the json schema file in resources/EFL_SARXBatchSchema.ts

import fs from 'fs'
import path from 'path'
import { isObject, keys, omit, pick } from 'lodash'
import { compile } from 'json-schema-to-typescript'
import { AttributeInfos } from './attribute-infos'

// Augment the auto-generated json schema by adding additional information (e.g title) and
// remove fields which should not be displayed to the users (e.g @SeqNum)
function augmentJsonSchema(object: any, attributesInfo: typeof AttributeInfos) {
  if (!isObject(object)) {
    return
  }
  keys(object).forEach(function (key) {
    const localObj = (object as any)[key]
    if (isObject(localObj)) {
      // Augment with attribute title/description
      if (attributesInfo[key]) {
        ;(localObj as any).title = attributesInfo[key].title
        ;(localObj as any).description = attributesInfo[key].description
      }
      // Remove '@SeqNum'. Will be auto-added when generating the XML
      if (key === '@SeqNum') {
        ;(object as any)[key] = undefined
      } else if (key === 'required') {
        ;(object as any)[key] = ((object as any)[key] as string[]).filter(
          (v) => v !== '@SeqNum'
        )
      }
      augmentJsonSchema(localObj, attributesInfo)
    }
  })
  return object
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Xsd2JsonSchema = require('xsd2jsonschema').Xsd2JsonSchema

const XML_SCHEMA = fs.readFileSync(
  path.join(__dirname, '..', 'resources', 'EFL_SARXBatchSchema.xsd'),
  'utf8'
)
const xs2js = new Xsd2JsonSchema()
const convertedSchemas = xs2js.processAllSchemas({
  schemas: { schema: XML_SCHEMA },
})
let jsonSchema = convertedSchemas['schema'].getJsonSchema()

// EFilingBatchXML is the root element. We only need to keep 'EFilingBatchXML' in 'properties'.
jsonSchema.properties = pick(jsonSchema.properties, 'EFilingBatchXML')
jsonSchema = omit(jsonSchema, 'anyOf')
jsonSchema = augmentJsonSchema(jsonSchema, AttributeInfos)

fs.writeFileSync(
  path.join(__dirname, '..', 'resources', 'EFL_SARXBatchSchema.ts'),
  `export const FincenJsonSchema = ${JSON.stringify(jsonSchema, null, 2)}`
)

void compile(jsonSchema, 'EFL_SARXBatchSchema').then((ts) => {
  fs.writeFileSync(
    path.join(__dirname, '..', 'resources', 'EFL_SARXBatchSchema.type.ts'),
    ts
  )
})
