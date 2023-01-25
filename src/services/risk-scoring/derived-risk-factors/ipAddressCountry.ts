import * as geoip from 'fast-geoip'
import { TransactionRiskFactorValueHandler } from '.'

export const ARS_IPADDRESSCOUNTRY_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<string | undefined | null>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'ipAddressCountry',
    handler: async (transaction) => {
      const ipAddress = transaction?.deviceData?.ipAddress
      if (ipAddress == null) {
        return []
      }
      const ipInfo = await geoip.lookup(ipAddress)
      return ipInfo?.country ? [ipInfo.country] : []
    },
  },
]
