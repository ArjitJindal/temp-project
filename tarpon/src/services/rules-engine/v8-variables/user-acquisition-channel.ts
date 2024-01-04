import { lowerCase, startCase } from 'lodash'
import { FieldOrGroup } from '@react-awesome-query-builder/core'
import { ConsumerUserRuleVariable, BusinessUserRuleVariable } from './types'
import { AcquisitionChannel } from '@/@types/openapi-public/AcquisitionChannel'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { ACQUISITION_CHANNELS } from '@/@types/openapi-public-custom/AcquisitionChannel'

const uiDefinition: FieldOrGroup = {
  label: 'Acquisition Channel',
  type: 'select',
  valueSources: ['value', 'field', 'func'],
  fieldSettings: {
    listValues: ACQUISITION_CHANNELS.map((channel) => ({
      value: channel,
      title: startCase(lowerCase(channel)),
    })),
  },
}

export const CONSUMER_USER_ACQUISITION_CHANNEL: ConsumerUserRuleVariable<
  AcquisitionChannel | undefined
> = {
  key: 'acquisitionChannel',
  entity: 'CONSUMER_USER',
  uiDefinition,
  load: async (user: User) => {
    return user.acquisitionChannel
  },
}
export const BUSINESS_USER_ACQUISITION_CHANNEL: BusinessUserRuleVariable<
  AcquisitionChannel | undefined
> = {
  key: 'acquisitionChannel',
  entity: 'BUSINESS_USER',
  uiDefinition,
  load: async (user: Business) => {
    return user.acquisitionChannel
  },
}
