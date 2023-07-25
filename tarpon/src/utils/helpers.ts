import { isValidEmail } from './regex'
import { UserDetails } from '@/@types/openapi-public/UserDetails'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { MissingUser } from '@/@types/openapi-internal/MissingUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'

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

export function getFullName(userDetails: UserDetails | undefined): string {
  return formatConsumerName(userDetails?.name) ?? 'No name'
}

export function businessName(user: InternalBusinessUser): string {
  return user.legalEntity?.companyGeneralDetails?.legalName
}

export function getUserName(
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser | null
) {
  if (user == null || !('type' in user)) {
    return '-'
  }
  if (user.type === 'CONSUMER') {
    return getFullName(user.userDetails)
  }
  if (user.type === 'BUSINESS') {
    return businessName(user)
  }
  return neverReturn(user, '-')
}
