import { isValidEmail } from '@flagright/lib/utils'
import { uniq } from 'lodash'
import { mentionIdRegex, mentionRegex } from '@flagright/lib/constants'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { MissingUser } from '@/@types/openapi-internal/MissingUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'

export const checkEmail = (email: string) => {
  return isValidEmail(email)
}

export const checkMultipleEmails = (emails: string[]) => {
  return emails.every(checkEmail)
}

export function formatConsumerName(
  name: ConsumerName | undefined,
  ignoreMiddleName = false
): string | undefined {
  const result = (
    ignoreMiddleName
      ? [name?.firstName, name?.lastName]
      : [name?.firstName, name?.middleName, name?.lastName]
  )
    .filter(Boolean)
    .join(' ')
  // todo: i18n
  if (result === '') {
    return undefined
  }
  return result
}

export function neverReturn<T>(obj: never, defaultValue: T): T {
  return defaultValue
}

export function consumerName(user?: User, ignoreMiddleName = false): string {
  return formatConsumerName(user?.userDetails?.name, ignoreMiddleName) ?? ''
}

export function businessName(user?: Business): string {
  return user?.legalEntity?.companyGeneralDetails?.legalName ?? ''
}

export function getUserName(
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser | null
) {
  if (user == null || !('type' in user)) {
    return '-'
  }
  if (user.type === 'CONSUMER') {
    return consumerName(user)
  }
  if (user.type === 'BUSINESS') {
    return businessName(user)
  }
  return neverReturn(user, '-')
}

export function getAddress(
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser | null
): string {
  if (user == null || !('type' in user)) {
    return '-'
  }
  if (user.type === 'CONSUMER') {
    return user.contactDetails?.addresses?.at(0)?.addressLines.join(', ') || ''
  }
  if (user.type === 'BUSINESS') {
    return (
      user.legalEntity.contactDetails?.addresses
        ?.at(0)
        ?.addressLines.join(', ') || ''
    )
  }
  return ''
}

export function isStatusInReview(status: CaseStatus | undefined): boolean {
  return status?.startsWith('IN_REVIEW') ?? false
}

export function statusEscalated(status: CaseStatus | undefined): boolean {
  return status?.includes('ESCALATED') ?? false
}

export function statusEscalatedL2(status: CaseStatus | undefined): boolean {
  return status?.includes('ESCALATED_L2') ?? false
}

export function shouldUseReviewAssignments(
  status: CaseStatus | undefined
): boolean {
  return statusEscalated(status) || isStatusInReview(status)
}

export function getMentionsFromComments(body?: string): string[] {
  if (!body) {
    return []
  }
  const mentions = body?.match(mentionRegex)?.map((mention) => {
    return mention
      .match(mentionIdRegex)
      ?.map((s) => s.substring(1, s.length - 1))[0]
  })
  return uniq(mentions).filter(Boolean) as string[]
}

export function getParsedCommentBody(body?: string) {
  if (!body) {
    return ''
  }
  const result = body.split(mentionRegex)
  return result.filter((e) => !e.match(/^(google-oauth2|auth0)\|\S+$/)).join('')
}

export const isStatusInProgress = (status: CaseStatus | undefined): boolean => {
  return status?.includes('IN_PROGRESS') ?? false
}

export const isStatusOnHold = (status: CaseStatus | undefined): boolean => {
  return status?.includes('ON_HOLD') ?? false
}
