// Usage: ts-node src/services/sar/generators/US/SAR/scripts/xml-to-json.ts
// It'll output the json schema file in resources/EFL_SARXBatchSchema.ts

import fs from 'fs'
import path from 'path'
import { isObject, keys, omit, pick } from 'lodash'
import { compile } from 'json-schema-to-typescript'
import { XMLParser } from 'fast-xml-parser'
import { AttributeInfos } from './attribute-infos'
import { removeActivityBlockOrder } from '@/services/sar/utils/augmentations/removeActivityBlockOrder'
import { removeUnnecessaryOneOf } from '@/services/sar/utils/augmentations/removeUnnecessaryOneOf'

// Augment the auto-generated json schema by adding additional information (e.g title) and
// remove fields which should not be displayed to the users (e.g @SeqNum)
function augmentJsonSchema(
  xml: any,
  object: any,
  attributesInfo: { [key: string]: { title: string; description: string } }
) {
  if (!isObject(object)) {
    return
  }
  object = object as any
  keys(object).forEach(function (key) {
    let localObj = object[key]
    if (isObject(localObj)) {
      localObj = removeUnnecessaryOneOf(localObj)
      object[key] = localObj
      // Augment with attribute title/description
      if (attributesInfo[key]) {
        ;(localObj as any).title = attributesInfo[key].title
        ;(localObj as any).description = attributesInfo[key].description
        ;(localObj as any)['ui:schema'] = (attributesInfo[key] as any)[
          'ui:schema'
        ]
      }
      // Remove '@SeqNum'. Will be auto-added when generating the XML
      if (key === '@SeqNum') {
        object[key] = undefined
      } else if (key === 'required') {
        object[key] = (object[key] as string[]).filter((v) => v !== '@SeqNum')
      }
      // Add enum description
      if (object[key]?.enum) {
        const targetXmlEnum = xml['xsd:schema']['xsd:simpleType'].find(
          (v: any) => v['@name'] === key
        )
        if (targetXmlEnum) {
          const enumNames: string[] = targetXmlEnum['xsd:restriction'][
            'xsd:enumeration'
          ].map((v: any) => v['xsd:annotation']?.['xsd:documentation'])
          if (enumNames.find(Boolean)) {
            object[key].enumNames = enumNames
            // To make sure enum and enumNames have the same order
            object[key].enum = targetXmlEnum['xsd:restriction'][
              'xsd:enumeration'
            ].map((v: any) => v['@value'])
          }
        }
      }
      augmentJsonSchema(xml, localObj, attributesInfo)
    }
  })

  return object
}

const XML_SCHEMA = fs.readFileSync(
  path.join(__dirname, '..', 'resources', 'EFL_SARXBatchSchema.xsd'),
  'utf8'
)
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
})
const xml = parser.parse(XML_SCHEMA)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Xsd2JsonSchema = require('xsd2jsonschema').Xsd2JsonSchema
const xs2js = new Xsd2JsonSchema()
const convertedSchemas = xs2js.processAllSchemas({
  schemas: { schema: XML_SCHEMA },
})
let jsonSchema = convertedSchemas['schema'].getJsonSchema()
// EFilingBatchXML is the root element. We only need to keep 'EFilingBatchXML' in 'properties'.
jsonSchema.properties = pick(jsonSchema.properties, 'EFilingBatchXML')
jsonSchema = omit(jsonSchema, 'anyOf')
jsonSchema = augmentJsonSchema(
  xml,
  jsonSchema,
  AttributeInfos as any as {
    [key: string]: { title: string; description: string }
  }
)
jsonSchema = removeActivityBlockOrder(jsonSchema)
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
