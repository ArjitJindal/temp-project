import { lowerCase, startCase } from 'lodash'
import { UserRuleVariable } from './types'
import { AcquisitionChannel } from '@/@types/openapi-public/AcquisitionChannel'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { ACQUISITION_CHANNELS } from '@/@types/openapi-public-custom/AcquisitionChannel'

export const USER_ACQUISITION_CHANNEL: UserRuleVariable<
  AcquisitionChannel | undefined
> = {
  key: 'acquisitionChannel',
  entity: 'USER',
  uiDefinition: {
    label: 'Acquisition Channel',
    type: 'select',
    valueSources: ['value', 'field', 'func'],
    fieldSettings: {
      listValues: ACQUISITION_CHANNELS.map((channel) => ({
        value: channel,
        title: startCase(lowerCase(channel)),
      })),
    },
  },
  load: async (user: User | Business) => {
    return user.acquisitionChannel
  },
}
