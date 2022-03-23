import * as ajv from 'ajv'
import { Rule } from '../src/@types/openapi-internal/Rule'

interface RuleParameters {
  threshold: number
}

export const event = {
  resource: '/rules/{ruleId}',
  path: '/rules/R-1',
  httpMethod: 'PUT',
  requestContext: { authorizer: { principalId: 'test-tenant-id' } },
  pathParameters: {
    ruleId: 'R-1',
  },
  body: JSON.stringify({
    name: 'Updated awesome rule name',
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
  } as Rule),
}
