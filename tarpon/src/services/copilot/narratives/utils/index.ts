import { AttributeSet } from '../../attributes/attribute-set'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'

export const isScreening = (attributes: AttributeSet) => {
  return attributes
    ?.getAttribute('rules')
    ?.some((r) => r.nature === 'SCREENING')
}

export const getStatusToPrefix = (status: AlertStatus | CaseStatus) => {
  switch (status) {
    case 'OPEN':
      return 'Opening'
    case 'CLOSED':
    case 'IN_REVIEW_CLOSED':
      return 'Closed'
    case 'IN_REVIEW_OPEN':
    case 'REOPENED':
    case 'IN_REVIEW_REOPENED':
      return 'Reopening'
    case 'ESCALATED':
    case 'IN_REVIEW_ESCALATED':
    case 'ESCALATED_L2':
      return 'Escalation'
    case 'OPEN_ON_HOLD':
    case 'ESCALATED_ON_HOLD':
    case 'ESCALATED_L2_ON_HOLD':
      return 'Holding'
    case 'OPEN_IN_PROGRESS':
    case 'ESCALATED_IN_PROGRESS':
    case 'ESCALATED_L2_IN_PROGRESS':
      return 'In Progress'
  }
}
