import { lowerCase, startCase } from 'lodash'
import { BusinessUserRuleVariable, ConsumerUserRuleVariable } from './types'
import { ConsumerUserSegment } from '@/@types/openapi-public/ConsumerUserSegment'
import { BusinessUserSegment } from '@/@types/openapi-public/BusinessUserSegment'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { CONSUMER_USER_SEGMENTS } from '@/@types/openapi-public-custom/ConsumerUserSegment'
import { BUSINESS_USER_SEGMENTS } from '@/@types/openapi-public-custom/BusinessUserSegment'

const createConsumerUserSegmentVariable = (): ConsumerUserRuleVariable<
  ConsumerUserSegment | undefined
> => ({
  key: `segment`,
  entity: 'CONSUMER_USER',
  uiDefinition: {
    label: `segment`,
    type: 'select',
    valueSources: ['value', 'field', 'func'],
    fieldSettings: {
      listValues: CONSUMER_USER_SEGMENTS.map((userSegment) => ({
        value: userSegment,
        title: startCase(lowerCase(userSegment)),
      })),
    },
  },
  load: async (user: User) => {
    return user.userSegment
  },
})

const createBusinessUserSegmentVariable = (): BusinessUserRuleVariable<
  BusinessUserSegment | undefined
> => ({
  key: `segment`,
  entity: 'BUSINESS_USER',
  uiDefinition: {
    label: `segment`,
    type: 'select',
    valueSources: ['value', 'field', 'func'],
    fieldSettings: {
      listValues: BUSINESS_USER_SEGMENTS.map((userSegment) => ({
        value: userSegment,
        title: startCase(lowerCase(userSegment)),
      })),
    },
  },
  load: async (user: Business) => {
    return user.legalEntity.companyGeneralDetails?.userSegment
  },
})

export const CONSUMER_USER_SEGMENT = createConsumerUserSegmentVariable()
export const BUSINESS_USER_SEGMENT = createBusinessUserSegmentVariable()
