import * as fs from 'fs'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
import isObject from 'lodash/isObject'
import keys from 'lodash/keys'
import omit from 'lodash/omit'
import pick from 'lodash/pick'
import { COUNTRY_CODES } from '@flagright/lib/constants'
import { removeUnnecessaryOneOf } from '../../../utils/augmentations/removeUnnecessaryOneOf'
import { transactionTypes } from '../common'
import { CURRENCY_CODES } from '@/@types/openapi-internal-custom/CurrencyCode'
const CTR_XML_SCHEMA = fs.readFileSync(
  path.join(__dirname, '..', 'CTR', 'resources', 'schema.xsd'),
  'utf8'
)
const STR_XML_SCHEMA = fs.readFileSync(
  path.join(__dirname, '..', 'STR', 'resources', 'schema.xsd'),
  'utf8'
)

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
})
const ctrXml = parser.parse(CTR_XML_SCHEMA)
const strXml = parser.parse(STR_XML_SCHEMA)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Xsd2JsonSchema = require('xsd2jsonschema').Xsd2JsonSchema
const xs2js = new Xsd2JsonSchema()
const convertedCTRSchemas = xs2js.processAllSchemas({
  schemas: { schema: CTR_XML_SCHEMA },
})
const convertedSTRSchemas = xs2js.processAllSchemas({
  schemas: { schema: STR_XML_SCHEMA },
})

let ctrJsonSchema = convertedCTRSchemas['schema'].getJsonSchema()
ctrJsonSchema.properties = pick(ctrJsonSchema.properties, [
  'ProviderType',
  'CtrDataType',
  'CashTransactionReport',
])
ctrJsonSchema = omit(ctrJsonSchema, 'anyOf')

let strJsonSchema = convertedSTRSchemas['schema'].getJsonSchema()
strJsonSchema.properties = pick(strJsonSchema.properties, [
  'ProviderType',
  'StrDataType',
  'SuspiciousTransactionReport',
])
strJsonSchema = omit(strJsonSchema, 'anyOf')

function augmentJsonSchema(xml: any, object: any) {
  if (!isObject(object)) {
    return
  }
  keys(object).forEach((key) => {
    let localObj = object[key]
    if (isObject(localObj)) {
      localObj = removeUnnecessaryOneOf(localObj)
      object[key] = localObj

      // if minItems is 1, then it is required

      if (key === 'Currency') {
        localObj.enum = CURRENCY_CODES
        ;(localObj as any)['ui:schema'] = {
          'ui:subtype': 'CURRENCY',
        }
      }

      if (key === 'Country') {
        localObj.enum = COUNTRY_CODES
        ;(localObj as any)['ui:schema'] = {
          'ui:subtype': 'COUNTRY',
        }
      }

      if (key === 'TransactionTypes') {
        localObj.enum = transactionTypes.map((t) => t[0])
        localObj.enumNames = transactionTypes.map((t) => t[1])
      }

      if (key === 'DateType') {
        delete localObj.pattern
        localObj.format = 'date'
      }

      if (key === 'PersonClassType') {
        localObj.enumNames = ['Natural person', 'Legal entity']
        localObj.type = 'string'
        delete localObj.minimum
        delete localObj.maximum
      }

      augmentJsonSchema(xml, localObj)
    }
  })
  return object
}

ctrJsonSchema = augmentJsonSchema(ctrXml, ctrJsonSchema)
strJsonSchema = augmentJsonSchema(strXml, strJsonSchema)
fs.writeFileSync(
  path.join(__dirname, '..', 'CTR', 'schema.ts'),
  `export const schema = ${JSON.stringify(ctrJsonSchema, null, 2)}`
)
fs.writeFileSync(
  path.join(__dirname, '..', 'STR', 'schema.ts'),
  `export const schema = ${JSON.stringify(strJsonSchema, null, 2)}`
)
