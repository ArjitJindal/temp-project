import {
  AcquisitionChannel,
  BusinessUserEvent,
  BusinessUserSegment,
  ConsumerUserEvent,
  ConsumerUserSegment,
  BusinessOptional,
  UserOptional,
  UserState,
} from 'flagright/api'
import { UserCreationAgeRange } from '../utils/rule-parameter-schemas'
import { KYCStatus } from '@/@types/openapi-internal/KYCStatus'
import { UserType } from '@/@types/user/user-type'

export type UserEvent =
  | (ConsumerUserEvent & { updatedConsumerUserAttributes?: UserOptional })
  | (BusinessUserEvent & { updatedBusinessUserAttributes?: BusinessOptional })

export type AuxiliaryIndexUserEvent = Partial<UserEvent> & {
  userKeyId: string
  timestamp: number
  userId: string
}

export type UserEventAttributes =
  | keyof UserOptional
  | keyof BusinessOptional
  | 'timestamp'

export type TimeRange = {
  beforeTimestamp: number // exclusive
  afterTimestamp: number // inclusive
}

export type UsersFilterOptions = {
  userCreationAgeRange?: UserCreationAgeRange
  userType?: UserType
  userAgeRange?: UserCreationAgeRange
  userIds?: string[]
  userResidenceCountries?: string[]
  userNationalityCountries?: string[]
  userRegistrationCountries?: string[]
  acquisitionChannels?: AcquisitionChannel[]
  consumerUserSegments?: ConsumerUserSegment[]
  businessUserSegments?: BusinessUserSegment[]
  kycStatus?: KYCStatus[]
  userStatus?: UserState[]
  userTags?: {
    [key: string]: string[]
  }
  userEventTimeRange?: TimeRange
}

export interface RulesEngineUserRepositoryInterface {
  getGenericUserEventsGenerator(
    userId: string | undefined,
    timeRange: TimeRange,
    filterOptions: UsersFilterOptions,
    attributesToFetch: Array<UserEventAttributes>,
    isConsumer: boolean
  ): AsyncGenerator<Array<AuxiliaryIndexUserEvent>>
}
