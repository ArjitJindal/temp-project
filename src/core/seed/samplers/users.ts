import { sampleCountry } from './countries'
import { sampleString } from './strings'
import { CompanyRegistrationDetails } from '@/@types/openapi-internal/CompanyRegistrationDetails'
import { KYCStatus } from '@/@types/openapi-internal/KYCStatus'
import { KYCStatusDetails } from '@/@types/openapi-internal/KYCStatusDetails'
import { UserState } from '@/@types/openapi-internal/UserState'
import { UserStateDetails } from '@/@types/openapi-internal/UserStateDetails'
import { randomInt } from '@/utils/prng'
import { USER_STATES } from '@/@types/openapi-internal-custom/UserState'
import { KYC_STATUSS } from '@/@types/openapi-internal-custom/KYCStatus'

export function sampleUserState(seed?: number): UserState {
  return USER_STATES[randomInt(seed, USER_STATES.length)]
}

export function sampleUserStateDetails(seed?: number): UserStateDetails {
  return {
    state: sampleUserState(seed),
  }
}

export function sampleKycStatus(seed?: number): KYCStatus {
  return KYC_STATUSS[randomInt(seed, KYC_STATUSS.length)]
}

export function sampleKycStatusDetails(seed?: number): KYCStatusDetails {
  return {
    status: sampleKycStatus(seed),
  }
}

export function sampleCompanyRegistrationDetails(
  seed?: number
): CompanyRegistrationDetails {
  return {
    registrationIdentifier: sampleString(seed),
    registrationCountry: sampleCountry(seed),
  }
}
