import { isValidEmail } from '@flagright/lib/utils'
import compact from 'lodash/compact'
import uniq from 'lodash/uniq'
import { mentionIdRegex, mentionRegex } from '@flagright/lib/constants/mentions'
import { envIs } from './env'
import { isDemoTenant } from './tenant-id'
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
import { Address } from '@/@types/openapi-public/Address'
import { Person } from '@/@types/openapi-public/Person'

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
  ignoreMiddleName = false,
  trimNameComponents = false
): string | undefined {
  const firstName = name?.firstName
    ? trimNameComponents
      ? name.firstName.trim()
      : name.firstName
    : undefined
  const middleName = name?.middleName
    ? trimNameComponents
      ? name.middleName.trim()
      : name.middleName
    : undefined
  const lastName = name?.lastName
    ? trimNameComponents
      ? name.lastName.trim()
      : name.lastName
    : undefined
  const result = (
    ignoreMiddleName ? [firstName, lastName] : [firstName, middleName, lastName]
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

export function consumerName(
  user?: User,
  ignoreMiddleName = false,
  trimNameComponents = false
): string {
  return (
    formatConsumerName(
      user?.userDetails?.name,
      ignoreMiddleName,
      trimNameComponents
    ) ?? ''
  )
}

export function businessName(user?: Business): string {
  return user?.legalEntity?.companyGeneralDetails?.legalName ?? ''
}

export function getUserName(
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser | null,
  trimNameComponents: boolean = false
) {
  if (user == null || !('type' in user)) {
    return '-'
  }
  if (user.type === 'CONSUMER') {
    return consumerName(user, false, trimNameComponents)
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
  address?: Address
}

type BankInfo = { bankName?: string; address?: Address }

export const extractBankInfoFromPaymentDetails = (
  paymentDetails: PaymentDetails
): BankInfo[] | undefined => {
  switch (paymentDetails.method) {
    case 'GENERIC_BANK_ACCOUNT':
    case 'IBAN':
    case 'ACH':
      return [
        {
          bankName: paymentDetails.bankName,
          address: paymentDetails.bankAddress,
        },
      ]
    case 'SWIFT': {
      const correspondentBankDetails = paymentDetails.correspondentBankDetails
      const bankNames: BankInfo[] =
        correspondentBankDetails?.map((correspondenceBankDetail) => ({
          bankName: correspondenceBankDetail.bankName,
        })) ?? []

      bankNames.push({
        bankName: paymentDetails.bankName,
        address: paymentDetails.bankAddress,
      })

      return bankNames
    }
    default:
      return undefined
  }
}

export const getPaymentDetailsNameString = (
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
    case 'NPP': {
      if (paymentDetails.name != null) {
        const formattedName = formatConsumerName(paymentDetails.name)
        if (formattedName != null) {
          namesToSearch.push({
            name: formattedName,
            entityType: 'PAYMENT_NAME',
            address: paymentDetails.address,
          })
        }
      }
      break
    }
    case 'WALLET': {
      if (paymentDetails.name) {
        namesToSearch.push({
          name: paymentDetails.name,
          countryOfNationality: paymentDetails.countryOfNationality,
          dateOfBirth: paymentDetails.dateOfBirth,
          entityType: 'PAYMENT_NAME',
        })
      }
      break
    }
  }

  return namesToSearch
}

export const isValidSARRequest = (tenantId: string) => {
  // remove dev after testing
  return (
    !isDemoTenant(tenantId) &&
    (envIs('sandbox') || envIs('prod') || envIs('dev'))
  )
}

export const getPersonName = (person?: Person) => {
  return compact([
    person?.generalDetails?.name?.firstName,
    person?.generalDetails?.name?.middleName,
    person?.generalDetails?.name?.lastName,
  ]).join(' ')
}

export const getAddressString = (address?: Address): string | undefined => {
  if (!address) {
    return undefined
  }
  return [
    ...address.addressLines,
    address.city,
    address.state,
    address.postcode,
    address.country,
  ]
    .filter(Boolean)
    .join(' ')
}

export const parseAddressStringForAggregation = (
  addressString: string
): Address | undefined => {
  if (!addressString) {
    return undefined
  }

  const decode = (val: string) =>
    val.replace(/__PIPE__/g, '|').replace(/__EQ__/g, '=')

  const parts = addressString.split('|')
  const map: Record<string, string> = {}

  for (const part of parts) {
    const [key, ...rest] = part.split('=')
    map[key] = decode(rest.join('=')) // in case value itself had '='
  }

  return {
    addressLines: map.LINES ? map.LINES.split('__LINE__').map(decode) : [],
    city: map.CITY ?? '',
    state: map.STATE ?? '',
    postcode: map.POSTCODE ?? '',
    country: map.COUNTRY ?? '',
  }
}

export const getNameStringForAggregation = (
  name?: ConsumerName | string
): string => {
  if (!name) {
    return ''
  }
  if (typeof name === 'string') {
    return name
  }
  return compact([
    `FIRST_NAME=${name.firstName}`,
    `MIDDLE_NAME=${name.middleName}`,
    `LAST_NAME=${name.lastName}`,
  ]).join('|')
}

export const isStringMasked = (str: string | undefined) =>
  str && str.length > 0 && /^\*+$/.test(str)

export const maskString = (str: string | undefined) =>
  str && str.length > 0 ? '*'.repeat(8) : undefined
