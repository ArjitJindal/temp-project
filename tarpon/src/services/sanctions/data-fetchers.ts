import { DowJonesDataFetcher } from '@/services/sanctions/providers/dow-jones'
import { SanctionsDataFetcher } from '@/services/sanctions/providers/types'

export async function sanctionsDataFetchers(): Promise<SanctionsDataFetcher[]> {
  return [await DowJonesDataFetcher.build()]
}
