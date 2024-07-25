import * as ipLocationAPI from '@maxmind/geoip2-node'
import * as ip from 'ip'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { logger } from '@/core/logger'
import { getSecretByName } from '@/utils/secrets-manager'
import { TransientRepository } from '@/core/repositories/transient-repository'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { duration } from '@/utils/dayjs'

export type IpLocation = {
  country?: string
  continent?: string
  city?: string
}

const CACHE_EXPIRATION_SECONDS = duration(1, 'month').asSeconds()
export async function lookupIpLocation(
  ipAddress: string,
  dynamodb: DynamoDBDocumentClient
): Promise<IpLocation> {
  if (
    ip.isPrivate(ipAddress) ||
    (!ip.isV4Format(ipAddress) && !ip.isV6Format(ipAddress))
  ) {
    return { country: '', continent: '', city: '' }
  }

  // Get from cache first
  const transientRepository = new TransientRepository<IpLocation>(
    dynamodb,
    CACHE_EXPIRATION_SECONDS
  )
  const cacheKeys = DynamoDbKeys.IP_ADDRESS_CACHE(ipAddress)
  const cacheResult = await transientRepository.get(
    cacheKeys.PartitionKeyID,
    cacheKeys.SortKeyID
  )
  if (cacheResult) {
    return cacheResult
  }

  // Cache miss, lookup IP location and cache it
  const geoip2secret = await getSecretByName('geoip2Creds')
  const ipLocationClient = new ipLocationAPI.WebServiceClient(
    geoip2secret.accountId,
    geoip2secret.licenseKey
  )
  try {
    const data = await ipLocationClient.city(ipAddress)
    const result = {
      country: data.country?.isoCode,
      continent: data.continent?.code,
      city: data.city?.names?.en,
    }
    await transientRepository.add(
      cacheKeys.PartitionKeyID,
      cacheKeys.SortKeyID,
      result
    )
    return result
  } catch (e) {
    logger.error('Error looking up IP location', e)
    return { country: '', continent: '', city: '' }
  }
}
