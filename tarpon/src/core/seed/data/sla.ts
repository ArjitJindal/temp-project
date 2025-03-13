import { memoize } from 'lodash'
import { SLAPolicy } from '@/@types/openapi-internal/SLAPolicy'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'

const generatePolicyId = (index: number): string => `SLA-${index.toString()}`

const SLA_POLICY_NAMES = {
  STANDARD_10_DAY: 'Standard 10-Day Response',
  STANDARD_5_DAY: 'Standard 5-Day Response',
  PRIORITY_CASES: 'Priority Cases Handler',
  EXTENDED_INVESTIGATION: 'Extended Investigation Cases',
} as const

const createBasicPolicy = (
  index: number,
  breachTime: number,
  warningTime: number,
  policyName: string
): SLAPolicy => ({
  id: generatePolicyId(index),
  name: policyName,
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
  warningTime: number,
  policyName: string
): SLAPolicy => ({
  ...createBasicPolicy(index, breachTime, warningTime, policyName),
  description: 'This is an advanced SLA policy.',
  policyConfiguration: {
    ...createBasicPolicy(index, breachTime, warningTime, policyName)
      .policyConfiguration,
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
  createBasicPolicy(1, 10, 5, SLA_POLICY_NAMES.STANDARD_10_DAY),
  createBasicPolicy(2, 5, 2, SLA_POLICY_NAMES.STANDARD_5_DAY),
  createAdvancedPolicy(3, 10, 5, SLA_POLICY_NAMES.PRIORITY_CASES),
  createAdvancedPolicy(4, 15, 7, SLA_POLICY_NAMES.EXTENDED_INVESTIGATION),
])

export const getSLAPolicyById = memoize((id: string): SLAPolicy | undefined => {
  return getSLAPolicies().find((policy) => policy.id === id)
})
