import * as yaml from 'js-yaml'
import { unflatten } from 'flat'
import fetch from 'node-fetch'
import Ajv, { ValidateFunction } from 'ajv'
import _ from 'lodash'
import { ConverterInterface } from './converter-interface'

export class FlagrightConverter<T> implements ConverterInterface<T> {
  schemaValidate?: ValidateFunction
  schemaName: string
  validatedItem?: T

  constructor(schemaName: string) {
    this.schemaName = schemaName
  }

  async initialize(): Promise<void> {
    const openapiYaml = await (
      await fetch(
        'https://stoplight.io/api/v1/projects/flagright/flagright-api/nodes/reference/Flagright-API.yaml'
      )
    ).text()
    const openapi = yaml.load(openapiYaml) as any
    const schemas = openapi['components']['schemas']

    if (!schemas[this.schemaName]) {
      throw Error(`${this.schemaName} is not a valid schema name`)
    }

    for (const key in schemas) {
      schemas[key]['$id'] = `#/components/schemas/${key}`
      schemas[key]['additionalProperties'] = false
    }
    const schema = JSON.parse(JSON.stringify(schemas[this.schemaName]))
    schema['$defs'] = schemas
    schema['additionalProperties'] = false
    const ajv = new Ajv({
      keywords: ['example', 'x-examples', 'x-stoplight'],
      coerceTypes: true,
    })
    this.schemaValidate = ajv.compile(schema)
  }
  getCsvParserOptions() {
    return { headers: true }
  }
  validate(rawItem: any): string[] {
    const item = unflatten(rawItem)
    const validate = this.schemaValidate as ValidateFunction
    validate(item)
    this.validatedItem = item as T
    return (
      validate.errors?.map((error) => {
        const errorKey =
          _.trim(error.instancePath, '/').replace('/', '.') ||
          error.params.additionalProperty
        return `${errorKey}: ${error.message}`
      }) || []
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  convert(rawItem: any): T {
    return this.validatedItem as T
  }
}
