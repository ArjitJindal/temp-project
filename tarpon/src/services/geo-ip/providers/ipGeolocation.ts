import { IpLookupProvider, IpLocation, ResolutionType } from '../types'
import { getSecretByName } from '@/utils/secrets-manager'
import { apiFetch } from '@/utils/api-fetch'

type IpGeolocationAPIResponse = {
  country_code2: string
  continent_code: string
  city: string
}

export class IpGeolocationProvider implements IpLookupProvider {
  source = 'ipgeolocation.io'
  enabled(): boolean {
    return true
  }
  cacheable(): boolean {
    return true
  }

  async resolveIp(
    ipAddress: string,
    _resolutionType: ResolutionType
  ): Promise<IpLocation | undefined> {
    const apiKey = (await getSecretByName('ipGeolocationCreds'))?.apiKey
    const { result } = await apiFetch<IpGeolocationAPIResponse>(
      `https://api.ipgeolocation.io/ipgeo?apiKey=${apiKey}&ip=${ipAddress}`
    )
    if (!result) {
      return undefined
    }
    return {
      country: result.country_code2,
      continent: result.continent_code,
      city: result.city ?? 'unknown',
    }
  }
}
