import { SanctionsDataFetcher } from '@/services/sanctions/providers/sanctions-data-fetcher'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { OpenSanctionsProvider } from '@/services/sanctions/providers/open-sanctions-provider'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'

export async function sanctionsDataFetchers(
  tenantId: string,
  provider: SanctionsDataProviderName
): Promise<SanctionsDataFetcher> {
  if (provider === 'dowjones') {
    return await DowJonesProvider.build(tenantId)
  }
  return await OpenSanctionsProvider.build(tenantId)
}
