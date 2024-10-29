import { Account } from '@/@types/openapi-internal/Account'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { NumberOperators } from '@/@types/openapi-internal/NumberOperators'
import {
  SLAPolicyConfiguration,
  SLAPolicyConfigurationWorkingDaysEnum,
} from '@/@types/openapi-internal/SLAPolicyConfiguration'
import { SLAPolicyStatus } from '@/@types/openapi-internal/SLAPolicyStatus'
import { getDerivedStatus } from '@/services/cases/utils'
import dayjs, { duration } from '@/utils/dayjs'
import {
  isStatusInReview,
  statusEscalated,
  statusEscalatedL2,
} from '@/utils/helpers'

export const dayMapping: Record<SLAPolicyConfigurationWorkingDaysEnum, number> =
  {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
  }

export function matchPolicyRoleConditions(
  policyConfiguration: SLAPolicyConfiguration,
  accounts: Account[]
): boolean {
  if (
    !policyConfiguration.accountRoles ||
    policyConfiguration.accountRoles.length === 0
  ) {
    return true
  }
  const roles = accounts.map((account) => account.role)
  if (
    roles.some((role) => {
      return policyConfiguration.accountRoles?.includes(role)
    })
  ) {
    return true
  }
  return false
}

export function matchPolicyStatusConditions(
  status: CaseStatus,
  statusCount: number,
  policyConfiguration: SLAPolicyConfiguration,
  accounts: {
    makerAccounts: Account[]
    reviewerAccounts: Account[]
  }
): boolean {
  const { makerAccounts, reviewerAccounts } = accounts
  const derivedStatus = getDerivedStatus(status)
  const isEscalatedL2 = statusEscalatedL2(status)
  const isEscalated = statusEscalated(status)
  const isInReview = isStatusInReview(status)

  const filteredAccounts = reviewerAccounts.filter((account) => {
    return (
      (isEscalatedL2 && account.escalationLevel === 'L2') ||
      isEscalated ||
      (isInReview && account.isReviewer === true)
    )
  })

  const policyMatch =
    isEscalated || isInReview || isEscalatedL2
      ? matchPolicyRoleConditions(policyConfiguration, filteredAccounts)
      : matchPolicyRoleConditions(policyConfiguration, makerAccounts)

  if (
    derivedStatus === 'CLOSED' ||
    !policyMatch ||
    !policyConfiguration.alertStatusDetails.alertStatuses.includes(
      derivedStatus
    )
  ) {
    return false
  }
  const configuredCountDetails = (
    policyConfiguration.alertStatusDetails.alertStatusesCount ?? []
  ).find((entry) => entry.status === derivedStatus)

  if (
    configuredCountDetails &&
    !operatorCheck(
      configuredCountDetails.operator,
      statusCount,
      configuredCountDetails.count
    )
  ) {
    return false
  }
  return true
}

export function getElapsedTime(
  startTime: number,
  endTime: number,
  workingDays: Array<SLAPolicyConfigurationWorkingDaysEnum>
): number {
  const start = dayjs(startTime).utc()
  const end = dayjs(endTime).utc()
  let elapsedTime = 0

  const workingDayNumbers = workingDays.map((day) => dayMapping[day])

  if (start.isSame(end, 'day')) {
    return workingDayNumbers.includes(start.day())
      ? end.diff(start, 'milliseconds')
      : 0
  }

  let current = start.clone()

  while (current.isBefore(end)) {
    const dayOfWeek = current.day()
    if (workingDayNumbers.includes(dayOfWeek)) {
      const dayEnd = current.endOf('day')
      const segmentEnd = dayEnd.isAfter(end) ? end : dayEnd
      const segmentStart = current.startOf('day').isAfter(start)
        ? current.startOf('day')
        : start

      elapsedTime += segmentEnd.diff(segmentStart, 'milliseconds') + 1
    }
    current = current.add(1, 'day')
  }

  return elapsedTime
}

export function getSLAStatusFromElapsedTime(
  elapsedTime: number,
  slaPolicyConfiguration: SLAPolicyConfiguration
): SLAPolicyStatus {
  const { warningTime, breachTime } = slaPolicyConfiguration.SLATime

  return warningTime &&
    elapsedTime <
      duration(warningTime.units, warningTime.granularity).asMilliseconds()
    ? 'OK'
    : elapsedTime >=
      duration(breachTime.units, breachTime.granularity).asMilliseconds()
    ? 'BREACHED'
    : warningTime
    ? 'WARNING'
    : 'OK'
}

export function operatorCheck(
  operator: NumberOperators,
  lhs: number,
  rhs: number
): boolean {
  switch (operator) {
    case 'EQ':
      return lhs === rhs
    case 'NE':
      return lhs !== rhs
    case 'GT':
      return lhs > rhs
    case 'GTE':
      return lhs >= rhs
    case 'LT':
      return lhs < rhs
    case 'LTE':
      return lhs <= rhs
    default:
      return false
  }
}
