// Usage: ts-node src/services/sar/generators/AU/SMR/scripts/xml-to-json.ts
// It'll output the json schema file in resources/SMRSchema.ts and resources/SMRSchema_Resolved.ts

import fs from 'fs'
import path from 'path'
import isObject from 'lodash/isObject'
import keys from 'lodash/keys'
import omit from 'lodash/omit'
import { compile } from 'json-schema-to-typescript'
import { XMLParser } from 'fast-xml-parser'
import $RefParser from '@apidevtools/json-schema-ref-parser'
import { AttributeInfos } from './attribute-info'
import { removeUnnecessaryOneOf } from '@/services/sar/utils/augmentations/removeUnnecessaryOneOf'
import {
  agumentAustracSmr,
  agumentUiSchemaAustracSmr,
} from '@/services/sar/utils/augmentations/manualSchemaManipulation'

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
        const targetXmlEnum = xml['xs:schema']['xs:simpleType'].find(
          (v: any) => v['@name'] === key
        )
        if (targetXmlEnum) {
          const enumNames: string[] = targetXmlEnum['xs:restriction'][
            'xs:enumeration'
          ].map((v: any) => v['xs:annotation']?.['xs:documentation'])
          if (enumNames.find(Boolean)) {
            object[key].enumNames = enumNames
            // To make sure enum and enumNames have the same order
            object[key].enum = targetXmlEnum['xs:restriction'][
              'xs:enumeration'
            ].map((v: any) => v['@value'])
          }
        }
      }
      augmentJsonSchema(xml, localObj, attributesInfo)
    }
  })

  return object
}

async function main() {
  const XML_SCHEMA = fs.readFileSync(
    path.join(__dirname, '..', 'resources', 'SMRSchema.xsd'),
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
  // jsonSchema.properties = pick(jsonSchema.properties, 'smrList')
  jsonSchema = omit(jsonSchema, 'anyOf')
  jsonSchema = augmentJsonSchema(
    xml,
    jsonSchema,
    AttributeInfos as any as {
      [key: string]: { title: string; description: string }
    }
  )

  jsonSchema['definitions'] = agumentAustracSmr(
    agumentUiSchemaAustracSmr(jsonSchema['definitions'])
  )
  fs.writeFileSync(
    path.join(__dirname, '..', 'resources', 'SMRSchema.ts'),
    `export const AustracJsonSchema = ${JSON.stringify(jsonSchema, null, 2)}`
  )

  void compile(jsonSchema, 'SMRSchema').then((ts) => {
    fs.writeFileSync(
      path.join(__dirname, '..', 'resources', 'SMRSchema.type.ts'),
      ts
    )
  })

  const stringifiedJson = await resolveSchema(jsonSchema)

  fs.writeFileSync(
    path.join(__dirname, '..', 'resources', 'SMRSchema_Resolved.ts'),
    `export const AustracJsonSchemaResolved = ${stringifiedJson}`
  )
}

async function resolveSchema(schema: string) {
  const dereferencedSchema = await $RefParser.dereference(schema)
  delete dereferencedSchema.properties
  return JSON.stringify(dereferencedSchema, null, 2)
}

main()
  .then(() => console.log('Execution completed'))
  .catch((e) => console.error(e))
