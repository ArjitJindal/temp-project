import { reverse } from 'lodash'
import { AlertCreationIntervalInstantly } from '@/@types/openapi-internal/AlertCreationIntervalInstantly'
import { AlertCreationIntervalMonthly } from '@/@types/openapi-internal/AlertCreationIntervalMonthly'
import { AlertCreationIntervalWeekly } from '@/@types/openapi-internal/AlertCreationIntervalWeekly'
import dayjs, { Timezone, WEEKDAY_NUMBERS, duration } from '@/utils/dayjs'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Case } from '@/@types/openapi-internal/Case'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { DerivedStatus } from '@/@types/openapi-internal/DerivedStatus'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'

export function calculateCaseAvailableDate(
  now: number,
  alertCreationInterval:
    | AlertCreationIntervalInstantly
    | AlertCreationIntervalWeekly
    | AlertCreationIntervalMonthly,
  timezone: Timezone
): number | undefined {
  if (alertCreationInterval.type === 'INSTANTLY') {
    return undefined
  }
  let d = dayjs(now).tz(timezone)
  if (alertCreationInterval.type === 'MONTHLY') {
    const newDayOfMonth = alertCreationInterval.day
    const currentDayOfMonth = d.date()
    if (currentDayOfMonth >= newDayOfMonth) {
      d = d.add(1, 'month')
    }
    d = d.date(Math.min(newDayOfMonth, d.daysInMonth()))
  } else if (alertCreationInterval.type === 'WEEKLY') {
    const newDayOfWeek = WEEKDAY_NUMBERS[alertCreationInterval.day]
    const currentDayOfWeek = d.day()
    if (currentDayOfWeek < newDayOfWeek) {
      d = d.day(newDayOfWeek)
    } else {
      d = d
        .day(0)
        .week(d.week() + 1)
        .day(newDayOfWeek)
    }
  }
  d = d.startOf('day')
  return d.valueOf()
}

export function getLatestInvestigationTime(
  statusChanges: CaseStatusChange[] | undefined
): number | null {
  if (!statusChanges || !statusChanges.length) {
    return null
  }
  const reversedStatuses = reverse(statusChanges)
  const lastClosedStatusIndex = reversedStatuses.findIndex(
    (v) => v.caseStatus === 'CLOSED'
  )
  const lastClosedStatus = reversedStatuses[lastClosedStatusIndex]
  if (!lastClosedStatus) {
    return null
  }

  const slicedReversedStatuses = reversedStatuses.slice(
    lastClosedStatusIndex + 1
  )
  const newClosedIndex = slicedReversedStatuses.findIndex(
    (v) => v.caseStatus === 'CLOSED'
  )
  const updatedClosedIndex =
    newClosedIndex === -1 ? slicedReversedStatuses.length - 1 : newClosedIndex
  const firstInProgressStatus = reverse(
    slicedReversedStatuses.slice(0, updatedClosedIndex + 1)
  ).find((v) => v.caseStatus && v.caseStatus.endsWith('IN_PROGRESS'))

  if (!firstInProgressStatus) {
    return null
  }

  return duration(
    dayjs(lastClosedStatus?.timestamp).diff(firstInProgressStatus?.timestamp)
  ).asMilliseconds()
}

export function isCaseAvailable(caseItem: Case): boolean {
  if (caseItem.availableAfterTimestamp == null) {
    return true
  }
  return Date.now() > caseItem.availableAfterTimestamp
}

export function isAlertAvailable(alert: Alert): boolean {
  if (alert.availableAfterTimestamp == null) {
    return true
  }
  return Date.now() > alert.availableAfterTimestamp
}

export function getDerivedStatus(
  status: AlertStatus | undefined
): DerivedStatus {
  switch (status) {
    case 'IN_REVIEW_OPEN':
    case 'IN_REVIEW_CLOSED':
    case 'IN_REVIEW_REOPENED':
    case 'IN_REVIEW_ESCALATED': {
      return 'IN_REVIEW'
    }
    case 'OPEN_IN_PROGRESS':
      return 'IN_PROGRESS'
    case 'OPEN_ON_HOLD': {
      return 'ON_HOLD'
    }
    case 'ESCALATED_IN_PROGRESS':
    case 'ESCALATED_ON_HOLD': {
      return 'ESCALATED'
    }
    case 'ESCALATED_L2_IN_PROGRESS':
    case 'ESCALATED_L2_ON_HOLD': {
      return 'ESCALATED_L2'
    }
    default:
      return status as DerivedStatus
  }
}
