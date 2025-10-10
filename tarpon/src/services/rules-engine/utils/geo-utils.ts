import { DeviceData } from '@/@types/openapi-public/DeviceData'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { GeoIPService } from '@/services/geo-ip'

export const hydrateIpInfo = async (
  geoService: GeoIPService,
  transaction?: {
    originDeviceData?: DeviceData
    destinationDeviceData?: DeviceData
  }
) => {
  await Promise.all([
    resolveAndAssignCountry(geoService, transaction?.originDeviceData),
    resolveAndAssignCountry(geoService, transaction?.destinationDeviceData),
  ])
}
export const resolveAndAssignCountry = async (
  geoService: GeoIPService,
  deviceData?: DeviceData
) => {
  if (deviceData && deviceData.ipAddress && !deviceData.ipCountry) {
    const ipInfo = await geoService.resolveIpAddress(
      deviceData.ipAddress,
      'COUNTRY',
      true
    )
    deviceData.ipCountry = ipInfo?.country as CountryCode
  }
}
