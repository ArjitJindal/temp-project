import * as ipLocationAPI from '@maxmind/geoip2-node'
import { IpLookupProvider, IpLocation, ResolutionType } from '../types'
import { getSecretByName } from '@/utils/secrets-manager'

enum GeoIpError {
  NOT_FOUND = 'IP_ADDRESS_NOT_FOUND',
  RESERVED = 'IP_ADDRESS_RESERVED',
}

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
      if (error && typeof error === 'object' && 'code' in error) {
        if (
          error.code === GeoIpError.NOT_FOUND ||
          error.code === GeoIpError.RESERVED
        ) {
          const errorText =
            error.code === GeoIpError.NOT_FOUND ? 'unknown' : 'reserved'
          return {
            country: errorText,
            continent: errorText,
            city: resolutionType === 'CITY' ? errorText : undefined,
          }
        }
      }
      throw new Error(`[${(error as any)?.code}] ${(error as any)?.message}`)
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
