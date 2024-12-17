import { SanctionsDataFetcher } from '@/services/sanctions/providers/sanctions-data-fetcher'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { OpenSanctionsProvider } from '@/services/sanctions/providers/open-sanctions-provider'

export async function sanctionsDataFetchers(
  tenantId: string
): Promise<SanctionsDataFetcher[]> {
  return [
    await DowJonesProvider.build(tenantId),
    await OpenSanctionsProvider.build(tenantId),
  ]
}
