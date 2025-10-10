import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { AcurisProvider } from './providers/acuris-provider'
import { SanctionsDataProviders } from './types'
import { SanctionsDataFetcher } from '@/services/sanctions/providers/sanctions-data-fetcher'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { OpenSanctionsProvider } from '@/services/sanctions/providers/open-sanctions-provider'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsSettingsProviderScreeningTypes } from '@/@types/openapi-internal/SanctionsSettingsProviderScreeningTypes'

export async function sanctionsDataFetcher(
  tenantId: string,
  provider: SanctionsDataProviderName,
  connections: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBDocumentClient
  },
  settings?: SanctionsSettingsProviderScreeningTypes[]
): Promise<SanctionsDataFetcher | undefined> {
  if (provider === SanctionsDataProviders.DOW_JONES) {
    return await DowJonesProvider.build(tenantId, connections)
  }
  if (provider === SanctionsDataProviders.OPEN_SANCTIONS) {
    return await OpenSanctionsProvider.build(
      tenantId,
      connections,
      settings?.find(
        (setting) => setting.provider === SanctionsDataProviders.OPEN_SANCTIONS
      )
    )
  }
  if (provider === SanctionsDataProviders.ACURIS) {
    return await AcurisProvider.build(
      tenantId,
      connections,
      settings?.find(
        (setting) => setting.provider === SanctionsDataProviders.ACURIS
      )
    )
  }
}
