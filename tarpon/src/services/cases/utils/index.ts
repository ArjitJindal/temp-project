import reverse from 'lodash/reverse'
import { ActionReason } from '@/@types/openapi-internal/ActionReason'
import { Alert } from '@/@types/openapi-internal/Alert'
import { AlertCreationIntervalDaily } from '@/@types/openapi-internal/AlertCreationIntervalDaily'
import { AlertCreationIntervalInstantly } from '@/@types/openapi-internal/AlertCreationIntervalInstantly'
import { AlertCreationIntervalMonthly } from '@/@types/openapi-internal/AlertCreationIntervalMonthly'
import { AlertCreationIntervalWeekly } from '@/@types/openapi-internal/AlertCreationIntervalWeekly'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { DerivedStatus } from '@/@types/openapi-internal/DerivedStatus'
import dayjs, { Timezone, WEEKDAY_NUMBERS, duration } from '@/utils/dayjs'
import { envIs } from '@/utils/env'
import { generateChecksum } from '@/utils/object'
import {
  bulkSendMessages,
  getSQSClient,
  getSQSQueueUrl,
} from '@/utils/sns-sqs-client'

export function calculateCaseAvailableDate(
  now: number,
  alertCreationInterval:
    | AlertCreationIntervalInstantly
    | AlertCreationIntervalWeekly
    | AlertCreationIntervalMonthly
    | AlertCreationIntervalDaily,
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
  } else if (alertCreationInterval.type === 'DAILY') {
    const hour = parseInt(alertCreationInterval.time)
    const currentHour = d.tz(timezone).hour()

    if (currentHour < hour) {
      d = d.hour(hour).minute(0).second(0).millisecond(0)
    } else {
      d = d.add(1, 'day').hour(hour).minute(0).second(0).millisecond(0)
    }
  }

  if (alertCreationInterval.type !== 'DAILY') {
    d = d.startOf('day')
  }

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

export type ActionProcessingRecord = {
  entityId: string
  reason: ActionReason
  action: CaseStatus
  tenantId: string
}

export async function sendActionProcessionTasks(
  tasks: ActionProcessingRecord[]
) {
  if (envIs('local', 'test')) {
    const { actionProcessingHandler } = await import(
      '@/core/local-handlers/action-processing'
    )

    await actionProcessingHandler(tasks)
    return
  }
  const sqsClient = getSQSClient()
  const messages = tasks.map((task) => ({
    MessageBody: JSON.stringify(task),
    MessageDeduplicationId: generateChecksum(task.entityId),
  }))
  await bulkSendMessages(
    sqsClient,
    getSQSQueueUrl(process.env.ACTION_PROCESSING_QUEUE_URL as string),
    messages
  )
}
