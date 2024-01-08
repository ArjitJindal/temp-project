import { lowerCase, startCase } from 'lodash'
import { createRuleVariable } from './utils/variables'
import { ACQUISITION_CHANNELS } from '@/@types/openapi-internal-custom/AcquisitionChannel'
import { AcquisitionChannel } from '@/@types/openapi-internal/AcquisitionChannel'
import { Business } from '@/@types/openapi-internal/Business'
import { User } from '@/@types/openapi-internal/User'

const createAcquisitionUserRuleVariable = (
  type: 'CONSUMER_USER' | 'BUSINESS_USER'
) => {
  return createRuleVariable<AcquisitionChannel | undefined, typeof type>(
    'CONSUMER_USER',
    {
      key: 'acquisitionChannel',
      label: 'Acquisition Channel',
      valueType: 'string',
      load: async (user: User | Business) => user.acquisitionChannel,
      uiDefinition: {
        fieldSettings: {
          listValues: ACQUISITION_CHANNELS.map((ac) => ({
            title: startCase(lowerCase(ac)),
            value: ac,
          })),
        },
        type: 'select',
      },
    }
  )
}
export const BUSINESS_USER_ACQUISITION_CHANNEL =
  createAcquisitionUserRuleVariable('BUSINESS_USER')

export const CONSUMER_USER_ACQUISITION_CHANNEL =
  createAcquisitionUserRuleVariable('CONSUMER_USER')
