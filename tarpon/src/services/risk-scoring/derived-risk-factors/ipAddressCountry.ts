import { TransactionRiskFactorValueHandler } from '.'
import { addNewSubsegment } from '@/core/xray'

export const ARS_IPADDRESSCOUNTRY_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<string | undefined | null>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'ipAddressCountry',
    handler: async (transaction) => {
      const subsegemt = await addNewSubsegment(
        'ipAddressCountry',
        transaction?.deviceData?.ipAddress ?? 'unknown'
      )
      const ipAddress = transaction?.deviceData?.ipAddress
      if (ipAddress == null) {
        return []
      }
      const geoIp = await import('fast-geoip')
      const ipInfo = await geoIp.lookup(ipAddress)
      subsegemt?.close()
      return ipInfo?.country ? [ipInfo.country] : []
    },
  },
]
