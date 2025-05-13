import { isValidEmail } from '@flagright/lib/utils'
import { uniq } from 'lodash'
import { mentionIdRegex, mentionRegex } from '@flagright/lib/constants'
import { envIs } from './env'
import { isDemoTenant } from './tenant'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { MissingUser } from '@/@types/openapi-internal/MissingUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { CountryCode } from '@/@types/openapi-public/CountryCode'

export const checkEmail = (email: string) => {
  return isValidEmail(email)
}

export const checkMultipleEmails = (emails: string[]) => {
  return emails.every(checkEmail)
}

export const handleSmallNumber = (value: number) => {
  const EPSILON = 1e-12
  if (Math.abs(value) < EPSILON) {
    return 0.001 // Treat as 0.001
  }
  return value // Keep the original value
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

export type PaymentDetailsName = {
  name: string
  entityType: SanctionsDetailsEntityType
  countryOfNationality?: CountryCode
  dateOfBirth?: string
}

export const getBankNameFromPaymentDetails = (
  paymentDetails: PaymentDetails
): string | undefined => {
  switch (paymentDetails.method) {
    case 'GENERIC_BANK_ACCOUNT':
    case 'IBAN':
    case 'ACH':
    case 'SWIFT':
      return paymentDetails.bankName
    default:
      return undefined
  }
}

export const getPaymentDetailsName = (
  paymentDetails: PaymentDetails
): PaymentDetailsName[] => {
  const namesToSearch: PaymentDetailsName[] = []

  switch (paymentDetails.method) {
    case 'CARD':
      {
        const formattedName = formatConsumerName(paymentDetails.nameOnCard)
        if (formattedName != null) {
          namesToSearch.push({
            name: formattedName,
            entityType: 'NAME_ON_CARD',
          })
        }
      }
      break
    case 'GENERIC_BANK_ACCOUNT':
      {
        if (paymentDetails.name) {
          namesToSearch.push({
            name: paymentDetails.name,
            entityType: 'BANK_ACCOUNT_HOLDER_NAME',
            countryOfNationality: paymentDetails.countryOfNationality,
            dateOfBirth: paymentDetails.dateOfBirth,
          })
        }
      }
      break
    case 'IBAN':
      {
        if (paymentDetails.name) {
          namesToSearch.push({
            name: paymentDetails.name,
            entityType: 'BANK_ACCOUNT_HOLDER_NAME',
          })
        }
      }
      break
    case 'SWIFT':
    case 'UPI':
    case 'WALLET':
    case 'CHECK':
      if (paymentDetails.name != null) {
        namesToSearch.push({
          name: paymentDetails.name,
          entityType: 'PAYMENT_NAME',
        })
      }
      break
    case 'ACH':
      if (paymentDetails.name != null) {
        namesToSearch.push({
          name: paymentDetails.name,
          entityType: 'PAYMENT_NAME',
        })
      }
      if (paymentDetails.beneficiaryName != null) {
        namesToSearch.push({
          name: paymentDetails.beneficiaryName,
          entityType: 'PAYMENT_BENEFICIARY_NAME',
        })
      }
      break
    case 'MPESA':
    case 'CASH':
      break
  }

  return namesToSearch
}

export const isValidSARRequest = (tenantId: string) => {
  return !isDemoTenant(tenantId) && (envIs('sandbox') || envIs('prod'))
}
