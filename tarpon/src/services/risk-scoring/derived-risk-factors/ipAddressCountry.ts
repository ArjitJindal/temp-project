import { compact } from 'lodash'
import { TransactionRiskFactorValueHandler } from '.'
import { addNewSubsegment } from '@/core/xray'
import { getAllIpAddresses } from '@/utils/ipAddress'
import { lookupIpLocation } from '@/services/rules-engine/utils/geoip'
import { getDynamoDbClient } from '@/utils/dynamodb'

export const ARS_IPADDRESSCOUNTRY_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<string | undefined | null>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'ipAddressCountry',
    handler: async (transaction) => {
      const allIpAddress = getAllIpAddresses(transaction)

      const subsegemt = await addNewSubsegment(
        'ipAddressCountry',
        allIpAddress.join(', ') || 'unknown'
      )
      const originIpAddress = transaction?.originDeviceData?.ipAddress
      const destinationIpAddress = transaction?.destinationDeviceData?.ipAddress
      if (originIpAddress == null && destinationIpAddress == null) {
        return []
      }

      const dynamoDb = getDynamoDbClient()
      const [originIpInfo, destinationIpInfo] = await Promise.all([
        originIpAddress ? lookupIpLocation(originIpAddress, dynamoDb) : null,
        destinationIpAddress
          ? lookupIpLocation(destinationIpAddress, dynamoDb)
          : null,
      ])

      subsegemt?.close()

      return compact([originIpInfo?.country, destinationIpInfo?.country])
    },
  },
]
