import { memoize } from 'lodash'
import { SLAPolicy } from '@/@types/openapi-internal/SLAPolicy'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/alerts/repository'

const generatePolicyId = (index: number): string => `SLA-${index.toString()}`

const createBasicPolicy = (
  index: number,
  breachTime: number,
  warningTime: number
): SLAPolicy => ({
  id: generatePolicyId(index),
  name: `SLA Policy ${index}`,
  type: 'ALERT',
  description: 'This is a basic SLA policy.',
  policyConfiguration: {
    statusDetails: {
      statuses: ['OPEN'],
    },
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    SLATime: {
      breachTime: { units: breachTime, granularity: 'days' },
      warningTime: { units: warningTime, granularity: 'days' },
    },
  },
  createdBy: FLAGRIGHT_SYSTEM_USER,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

const createAdvancedPolicy = (
  index: number,
  breachTime: number,
  warningTime: number
): SLAPolicy => ({
  ...createBasicPolicy(index, breachTime, warningTime),
  description: 'This is an advanced SLA policy.',
  policyConfiguration: {
    ...createBasicPolicy(index, breachTime, warningTime).policyConfiguration,
    accountRoles: ['admin'],
    statusDetails: {
      statuses: ['OPEN', 'IN_PROGRESS'],
      statusesCount: [
        { status: 'OPEN', count: 2, operator: 'LTE' },
        { status: 'IN_PROGRESS', count: 10, operator: 'LTE' },
      ],
    },
  },
})

export const getSLAPolicies = memoize((): SLAPolicy[] => [
  createBasicPolicy(1, 10, 5),
  createBasicPolicy(2, 5, 2),
  createAdvancedPolicy(3, 10, 5),
  createAdvancedPolicy(4, 15, 7),
])

export const getSLAPolicyById = memoize((id: string): SLAPolicy | undefined => {
  return getSLAPolicies().find((policy) => policy.id === id)
})
