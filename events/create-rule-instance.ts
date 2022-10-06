import { TestApiEvent, TestApiRequestContext } from './types'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

export const event: TestApiEvent = {
  resource: '/rule_instances',
  path: '/rule_instances',
  httpMethod: 'POST',
  requestContext: {
    authorizer: { principalId: 'test-tenant-id' },
  } as TestApiRequestContext,
  body: JSON.stringify({
    type: 'TRANSACTION',
    ruleId: 'R-1',
    status: 'ACTIVE',
    parameters: { dormancyPeriodDays: 1 },
    riskLevelParameters: {
      VERY_HIGH: { dormancyPeriodDays: 1 },
      HIGH: { dormancyPeriodDays: 1 },
      MEDIUM: { dormancyPeriodDays: 1 },
      VERY_LOW: { dormancyPeriodDays: 1 },
      LOW: { dormancyPeriodDays: 1 },
    },
    action: 'FLAG',
    riskLevelActions: {
      VERY_HIGH: 'FLAG',
      HIGH: 'FLAG',
      MEDIUM: 'FLAG',
      VERY_LOW: 'FLAG',
      LOW: 'FLAG',
    },
  } as RuleInstance),
}
