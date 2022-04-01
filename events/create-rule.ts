import * as ajv from 'ajv'
import { Rule } from '@/@types/openapi-internal/Rule'

interface RuleParameters {
  threshold: number
}

export const event = {
  resource: '/rules',
  path: '/rules',
  httpMethod: 'POST',
  requestContext: { authorizer: { principalId: 'test-tenant-id' } },
  body: JSON.stringify({
    name: 'Awesome rule name',
    description: 'Awesome rule description',
    ruleImplementationFilename: 'code-path',
    parametersSchema: {
      type: 'object',
      properties: {
        threshold: {
          type: 'number',
          title: 'Threshold',
        },
      },
      required: ['threshold'],
    } as ajv.JSONSchemaType<RuleParameters>,
    defaultParameters: {
      threshold: 3,
    } as RuleParameters,
    defaultAction: 'FLAG',
  } as Rule),
}
