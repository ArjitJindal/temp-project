// Usage: ts-node US/SAR/scripts/xml-to-json.ts
// It'll output the json schema file in resources/EFL_SARXBatchSchema.ts

import fs from 'fs'
import path from 'path'
import _ from 'lodash'

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
jsonSchema.properties = _.pick(jsonSchema.properties, 'EFilingBatchXML')
jsonSchema = _.omit(jsonSchema, 'anyOf')

fs.writeFileSync(
  path.join(__dirname, '..', 'resources', 'EFL_SARXBatchSchema.ts'),
  `export const FincenJsonSchema = ${JSON.stringify(jsonSchema, null, 2)}`
)
