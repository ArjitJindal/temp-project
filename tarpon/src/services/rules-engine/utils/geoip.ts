import * as ipLocationAPI from '@maxmind/geoip2-node'
import * as ip from 'ip'
import { logger } from '@/core/logger'
import { getSecretByName } from '@/utils/secrets-manager'

export type IpLocation = {
  country?: string
  continent?: string
  city?: string
}

export async function lookupIpLocation(ipAddress: string): Promise<IpLocation> {
  if (ip.isPrivate(ipAddress)) {
    return { country: '', continent: '', city: '' }
  }

  const geoip2secret = await getSecretByName('geoip2Creds')
  const ipLocationClient = new ipLocationAPI.WebServiceClient(
    geoip2secret.accountId,
    geoip2secret.licenseKey
  )
  try {
    const data = await ipLocationClient.city(ipAddress)
    return {
      country: data.country?.isoCode,
      continent: data.continent?.code,
      city: data.city?.names?.en,
    }
  } catch (e) {
    logger.error('Error looking up IP location', e)
    return { country: '', continent: '', city: '' }
  }
}
