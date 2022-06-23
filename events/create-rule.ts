import { Rule } from '@/@types/openapi-internal/Rule'

export const event = {
  resource: '/rules',
  path: '/rules',
  httpMethod: 'POST',
  requestContext: { authorizer: { principalId: 'test-tenant-id' } },
  body: JSON.stringify({
    id: 'R-1',
    type: 'TRANSACTION',
    name: 'Awesome rule name',
    description: 'Awesome rule description',
    ruleImplementationName: 'first-activity-after-time-period',
    defaultParameters: {
      dormancyPeriodDays: 1,
    },
    defaultRiskLevelParameters: {
      VERY_HIGH: { dormancyPeriodDays: 1 },
      HIGH: { dormancyPeriodDays: 1 },
      MEDIUM: { dormancyPeriodDays: 1 },
      VERY_LOW: { dormancyPeriodDays: 1 },
      LOW: { dormancyPeriodDays: 1 },
    },
    defaultAction: 'FLAG',
    defaultRiskLevelActions: {
      VERY_HIGH: 'FLAG',
      HIGH: 'FLAG',
      MEDIUM: 'FLAG',
      VERY_LOW: 'FLAG',
      LOW: 'FLAG',
    },
  } as Rule),
}
