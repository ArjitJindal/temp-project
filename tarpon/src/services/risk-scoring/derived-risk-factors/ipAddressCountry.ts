import { compact } from 'lodash'
import { TransactionRiskFactorValueHandler } from '.'
import { addNewSubsegment } from '@/core/xray'
import { getAllIpAddresses } from '@/utils/ipAddress'

export const ARS_IPADDRESSCOUNTRY_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<string | undefined | null>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'ipAddressCountry',
    handler: async (transaction) => {
      const allIpAddress = getAllIpAddresses(transaction?.deviceData)

      const subsegemt = await addNewSubsegment(
        'ipAddressCountry',
        allIpAddress.join(', ') || 'unknown'
      )
      const ipAddress = transaction?.deviceData?.ipAddress
      const originIpAddress = transaction?.deviceData?.originIpAddress
      const destinationIpAddress = transaction?.deviceData?.destinationIpAddress
      if (
        ipAddress == null &&
        originIpAddress == null &&
        destinationIpAddress == null
      ) {
        return []
      }
      const geoIp = await import('fast-geoip')

      const [ipInfo, originIpInfo, destinationIpInfo] = await Promise.all([
        ipAddress ? geoIp.lookup(ipAddress) : null,
        originIpAddress ? geoIp.lookup(originIpAddress) : null,
        destinationIpAddress ? geoIp.lookup(destinationIpAddress) : null,
      ])

      subsegemt?.close()

      return compact([
        ipInfo?.country,
        originIpInfo?.country,
        destinationIpInfo?.country,
      ])
    },
  },
]
