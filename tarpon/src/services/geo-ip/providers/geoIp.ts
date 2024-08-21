import * as ipLocationAPI from '@maxmind/geoip2-node'
import { IpLookupProvider, IpLocation, ResolutionType } from '../types'
import { getSecretByName } from '@/utils/secrets-manager'

export class GeoIp2Provider implements IpLookupProvider {
  ipLocationClient?: ipLocationAPI.WebServiceClient
  source = 'GeoIp2'
  enabled(): boolean {
    return true
  }
  cacheable(): boolean {
    return true
  }

  async resolveIp(
    ipAddress: string,
    resolutionType: ResolutionType
  ): Promise<IpLocation | undefined> {
    await this.initialize()
    try {
      if (!this.ipLocationClient) {
        throw new Error('Geolocation client not initialized')
      }
      const data =
        resolutionType === 'CITY'
          ? await this.ipLocationClient.city(ipAddress)
          : await this.ipLocationClient.country(ipAddress)
      const result = {
        country: data.country?.isoCode,
        continent: data.continent?.code,
        city: this.isCityData(data)
          ? data.city?.names?.en ?? 'unknown'
          : undefined,
      }
      return result
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'IP_ADDRESS_NOT_FOUND'
      ) {
        return {
          country: 'unknown',
          continent: 'unknown',
          city: resolutionType === 'CITY' ? 'unknown' : undefined,
        }
      }
      throw new Error('GeoIp failed to resolve IP')
    }
  }

  private isCityData(data: any): data is ipLocationAPI.City {
    return data instanceof ipLocationAPI.City
  }

  public async initialize(): Promise<void> {
    const geoip2secret = await getSecretByName('geoip2Creds')
    this.ipLocationClient = new ipLocationAPI.WebServiceClient(
      geoip2secret.accountId,
      geoip2secret.licenseKey
    )
  }
}
