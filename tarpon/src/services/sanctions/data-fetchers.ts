import { SanctionsDataFetcher } from '@/services/sanctions/providers/sanctions-data-fetcher'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'

export async function sanctionsDataFetchers(
  tenantId: string
): Promise<SanctionsDataFetcher[]> {
  return [await DowJonesProvider.build(tenantId)]
}
