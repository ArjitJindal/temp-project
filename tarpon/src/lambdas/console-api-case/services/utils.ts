import { AlertCreationIntervalInstantly } from '@/@types/openapi-internal/AlertCreationIntervalInstantly'
import { AlertCreationIntervalMonthly } from '@/@types/openapi-internal/AlertCreationIntervalMonthly'
import { AlertCreationIntervalWeekly } from '@/@types/openapi-internal/AlertCreationIntervalWeekly'
import dayjs, { Timezone, WEEKDAY_NUMBERS } from '@/utils/dayjs'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Case } from '@/@types/openapi-internal/Case'

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
