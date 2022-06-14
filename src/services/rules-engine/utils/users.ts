import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { UserDetails } from '@/@types/openapi-public/UserDetails'

export function getFullName(userDetails: UserDetails | undefined): string {
  const result = [
    userDetails?.name?.firstName,
    userDetails?.name?.middleName,
    userDetails?.name?.lastName,
  ]
    .filter(Boolean)
    .join(' ')
  // todo: i18n
  if (result === '') {
    return '(No name)'
  }
  return result
}

export function businessName(user: InternalBusinessUser): string {
  return user.legalEntity.companyGeneralDetails.legalName
}

export function getUserName(
  user?: InternalConsumerUser | InternalBusinessUser
) {
  if (user == null) {
    return 'N/A'
  }
  if (user.type === 'CONSUMER') {
    return getFullName(user.userDetails)
  }
  if (user.type === 'BUSINESS') {
    return businessName(user)
  }
  return 'Not Found'
}
