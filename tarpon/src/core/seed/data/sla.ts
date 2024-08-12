import { memoize } from 'lodash'
import { SLAPolicy } from '@/@types/openapi-internal/SLAPolicy'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/alerts/repository'

const generatePolicyId = (index: number): string => {
  return `SLA-${index.toString().padStart(3, '0')}`
}

export const getSLAPolicies = memoize((): SLAPolicy[] => {
  return [
    {
      id: generatePolicyId(1),
      name: 'Basic SLA Policy',
      description: 'This is a basic SLA policy.',
      policyConfiguration: {
        alertStatusDetails: {
          alertStatuses: ['OPEN'],
        },
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        SLATime: {
          breachTime: {
            units: 10,
            granularity: 'days',
          },
        },
      },
      createdBy: FLAGRIGHT_SYSTEM_USER,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: generatePolicyId(2),
      name: 'Advanced SLA Policy',
      description: 'This is an advanced SLA policy.',
      policyConfiguration: {
        accountRoles: ['admin'],
        alertStatusDetails: {
          alertStatuses: ['OPEN', 'IN_PROGRESS'],
          alertStatusesCount: [
            {
              status: 'OPEN',
              count: 2,
              operator: 'LTE',
            },
            {
              status: 'IN_PROGRESS',
              count: 10,
              operator: 'LTE',
            },
          ],
        },
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        SLATime: {
          breachTime: {
            units: 10,
            granularity: 'days',
          },
          warningTime: {
            units: 5,
            granularity: 'days',
          },
        },
      },
      createdBy: FLAGRIGHT_SYSTEM_USER,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]
})
