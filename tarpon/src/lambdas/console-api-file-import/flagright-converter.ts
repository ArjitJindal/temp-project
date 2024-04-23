import * as yaml from 'js-yaml'
import { unflatten } from 'flat'
import Ajv, { ValidateFunction } from 'ajv'

import { trim } from 'lodash'
import { ConverterInterface } from './converter-interface'
import { traceable } from '@/core/xray'
import { apiFetch } from '@/utils/api-fetch'

@traceable
export class FlagrightConverter<T> implements ConverterInterface<T> {
  schemaValidate?: ValidateFunction
  schemaName: string
  validatedItem?: T

  constructor(schemaName: string) {
    this.schemaName = schemaName
  }

  async initialize(): Promise<void> {
    const openapiYaml = (
      await apiFetch<string>('fix me if this class is being used again')
    ).result
    const openapi = yaml.load(openapiYaml) as any
    const schemas = openapi['components']['schemas']

    if (!schemas[this.schemaName]) {
      throw Error(`${this.schemaName} is not a valid schema name`)
    }

    for (const key in schemas) {
      schemas[key]['$id'] = `#/components/schemas/${key}`
    }
    const ajv = new Ajv({
      keywords: ['example', 'x-examples'],
      coerceTypes: true,
      schemas: Object.values(schemas).map((schema) =>
        JSON.parse(JSON.stringify(schema))
      ),
    })
    this.schemaValidate = ajv.getSchema(
      `#/components/schemas/${this.schemaName}`
    )
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
          trim(error.instancePath, '/').replace('/', '.') ||
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
