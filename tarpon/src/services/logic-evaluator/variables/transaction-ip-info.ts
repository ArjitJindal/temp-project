import { FieldOrGroup } from '@react-awesome-query-builder/core'
import { capitalize } from 'lodash'
import { TransactionLogicVariable } from './types'
import { getCountriesOptions } from './utils'
import { GeoIPService } from '@/services/geo-ip'

const getUiDefinition = (
  direction: 'ORIGIN' | 'DESTINATION',
  granularity: 'COUNTRY' | 'CITY'
): FieldOrGroup => ({
  label: `${direction.toLowerCase()} IP ${granularity.toLowerCase()}`,
  type: 'text',
  valueSources: ['value', 'field', 'func'],
  ...(granularity === 'COUNTRY'
    ? {
        fieldSettings: {
          listValues: getCountriesOptions(),
          allowCustomValues: true,
        },
      }
    : {}),
})

const createIpVariable = (
  direction: 'ORIGIN' | 'DESTINATION',
  granularity: 'COUNTRY' | 'CITY'
): TransactionLogicVariable => {
  return {
    key: `${direction.toLowerCase()}Ip${capitalize(granularity)}`,
    entity: 'TRANSACTION',
    uiDefinition: getUiDefinition(direction, granularity),
    valueType: 'string',
    load: async (transaction, context) => {
      if (!context) {
        throw new Error('Missing context')
      }
      const lookupIPLocationService = new GeoIPService(
        context?.tenantId ?? '',
        context.dynamoDb
      )
      const ipAddress =
        direction === 'ORIGIN'
          ? transaction?.originDeviceData?.ipAddress
          : transaction?.destinationDeviceData?.ipAddress
      const info = ipAddress
        ? await lookupIPLocationService.resolveIpAddress(ipAddress, granularity)
        : undefined
      return info?.[granularity.toLowerCase()]
    },
    sourceField:
      direction === 'ORIGIN' ? 'originDeviceData' : 'destinationDeviceData',
  }
}

export const TRANSACTION_ORIGIN_IP_CITY_VARIABLE = createIpVariable(
  'ORIGIN',
  'CITY'
)
export const TRANSACTION_DESTINATION_IP_CITY_VARIABLE = createIpVariable(
  'DESTINATION',
  'CITY'
)

export const TRANSACTION_ORIGIN_IP_COUNTRY_VARIABLE = createIpVariable(
  'ORIGIN',
  'COUNTRY'
)
export const TRANSACTION_DESTINATION_IP_COUNTRY_VARIABLE = createIpVariable(
  'DESTINATION',
  'COUNTRY'
)
