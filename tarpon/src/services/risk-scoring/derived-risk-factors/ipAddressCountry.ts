import { compact } from 'lodash'
import { TransactionRiskFactorValueHandler } from '.'
import { addNewSubsegment } from '@/core/xray'
import { getAllIpAddresses } from '@/utils/ipAddress'
import { GeoIPService } from '@/services/geo-ip'
import { getContext } from '@/core/utils/context'

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
      const context = getContext()
      const lookupIPLocationService = new GeoIPService(context?.tenantId ?? '')
      const [originIpInfo, destinationIpInfo] = await Promise.all([
        originIpAddress
          ? lookupIPLocationService.resolveIpAddress(originIpAddress)
          : null,
        destinationIpAddress
          ? lookupIPLocationService.resolveIpAddress(destinationIpAddress)
          : null,
      ])

      subsegemt?.close()

      return compact([originIpInfo?.country, destinationIpInfo?.country])
    },
  },
]
