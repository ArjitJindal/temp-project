import { Collection } from 'mongodb'
import { SanctionsProviderResponse } from '@/services/sanctions/providers/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getContext } from '@/core/utils/context'
import { SANCTIONS_PROVIDER_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { generateChecksum } from '@/utils/object'

export class SanctionsProviderSearchRepository {
  async saveSearch(
    results: Array<SanctionsEntity>,
    request: SanctionsSearchRequest
  ) {
    const providerSearchId =
      request.existingProviderId || generateChecksum(request, 36)
    return {
      providerSearchId,
      hitsCount: results.length,
      data: results,
      createdAt: new Date().getTime(),
      request,
    }
    // TODO disabling this for the time being
    // const sanctionsProviderCollection =
    //   await this.getSanctionProviderCollection()
    // await sanctionsProviderCollection.updateOne(
    //   { providerSearchId },
    //   { $set: object },
    //   {
    //     upsert: true,
    //   }
    // )
  }

  async getSearchResult(
    providerSearchId: string
  ): Promise<SanctionsProviderResponse> {
    // TODO disabling this for the time being
    throw new Error(`Search not found for ${providerSearchId}`)
    //
    // const result = await (
    //   await this.getSanctionProviderCollection()
    // ).findOne({
    //   providerSearchId: providerSearchId,
    // })
    //
    // if (!result) {
    //   throw new Error(`Search not found for ${providerSearchId}`)
    // }
    // return result
  }
  async deleteSearchResult(providerSearchId: string): Promise<void> {
    const sanctionsProviderCollection =
      await this.getSanctionProviderCollection()
    await sanctionsProviderCollection.deleteOne({
      providerSearchId: providerSearchId,
    })
  }

  async setMonitoring(
    providerSearchId: string,
    monitor: boolean
  ): Promise<void> {
    const sanctionsProviderCollection =
      await this.getSanctionProviderCollection()
    await sanctionsProviderCollection.updateOne(
      {
        providerSearchId,
      },
      {
        $set: {
          monitor,
        },
      }
    )
  }

  private async getSanctionProviderCollection(): Promise<
    Collection<SanctionsProviderResponse>
  > {
    const client = await getMongoDbClient()
    const tenantId = getContext()?.tenantId
    if (!tenantId) {
      throw new Error('No tenant ID')
    }
    return client
      .db()
      .collection(SANCTIONS_PROVIDER_SEARCHES_COLLECTION(tenantId))
  }
}
