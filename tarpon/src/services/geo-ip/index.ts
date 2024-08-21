import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { GEO_IP_PROVIDERS } from './providers'
import { IpLocation, IpLookupProvider, ResolutionType } from './types'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { TransientRepository } from '@/core/repositories/transient-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { duration } from '@/utils/dayjs'

const CACHE_EXPIRATION_SECONDS = duration(1, 'month').asSeconds()

@traceable
export class GeoIPService {
  tenantId: string
  providers: IpLookupProvider[]
  dynamodb: DynamoDBDocumentClient = getDynamoDbClient()

  constructor(
    tenantId: string,
    providers = GEO_IP_PROVIDERS.filter((provider) => provider.enabled())
  ) {
    this.tenantId = tenantId
    this.providers = providers
  }

  public async resolveIpAddress(
    ipAddress: string,
    resolutionType: ResolutionType = 'COUNTRY'
  ): Promise<IpLocation | null> {
    try {
      const cachedResult = await this.getCache(ipAddress)
      if (
        cachedResult &&
        (cachedResult.city ||
          (resolutionType === 'COUNTRY' && cachedResult.country))
      ) {
        return cachedResult
      }

      const result = await this.queryProviders(ipAddress, resolutionType)
      return result
    } catch (e) {
      logger.error(`Failed to resolve IP address ${ipAddress} - ${e}`)
      return null
    }
  }

  private async queryProviders(
    ipAddress: string,
    resolutionType: ResolutionType
  ): Promise<IpLocation | null> {
    if (this.providers.length === 0) {
      throw new Error('No IP location providers enabled')
    }
    for (const provider of this.providers) {
      try {
        const response = await provider.resolveIp(ipAddress, resolutionType)
        if (provider.cacheable() && response) {
          await this.setCache(ipAddress, { ...response })
        }
        if (response) {
          return response
        }
      } catch (e) {
        logger.error(
          `Failed to resolve IP address ${ipAddress} with ${provider.source} - ${e}`
        )
      }
    }
    return null
  }

  private async getCache(ipAddress: string): Promise<IpLocation | undefined> {
    const transientRepository = new TransientRepository<IpLocation>(
      this.dynamodb,
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
  }

  private async setCache(ipAddress: string, result: IpLocation): Promise<void> {
    const transientRepository = new TransientRepository<IpLocation>(
      this.dynamodb,
      CACHE_EXPIRATION_SECONDS
    )
    const cacheKeys = DynamoDbKeys.IP_ADDRESS_CACHE(ipAddress)
    await transientRepository.add(
      cacheKeys.PartitionKeyID,
      cacheKeys.SortKeyID,
      result
    )
  }
}
