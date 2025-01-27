import { AcurisProvider } from './providers/acuris-provider'
import { SanctionsDataFetcher } from '@/services/sanctions/providers/sanctions-data-fetcher'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { OpenSanctionsProvider } from '@/services/sanctions/providers/open-sanctions-provider'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsSettingsProviderScreeningTypes } from '@/@types/openapi-internal/SanctionsSettingsProviderScreeningTypes'

export const FEATURE_FLAG_PROVIDER_MAP: Record<
  string,
  SanctionsDataProviderName
> = {
  DOW_JONES: 'dowjones',
  OPEN_SANCTIONS: 'open-sanctions',
  ACURIS: 'acuris',
}

export async function sanctionsDataFetchers(
  tenantId: string,
  providers: SanctionsDataProviderName[],
  settings?: SanctionsSettingsProviderScreeningTypes[]
): Promise<SanctionsDataFetcher[]> {
  const fetchers: SanctionsDataFetcher[] = []
  if (providers.includes('dowjones')) {
    fetchers.push(await DowJonesProvider.build(tenantId))
  }
  if (providers.includes('open-sanctions')) {
    fetchers.push(
      await OpenSanctionsProvider.build(
        tenantId,
        settings?.find((setting) => setting.provider === 'open-sanctions')
      )
    )
  }
  if (providers.includes('acuris')) {
    fetchers.push(
      await AcurisProvider.build(
        tenantId,
        settings?.find((setting) => setting.provider === 'acuris')
      )
    )
  }
  return fetchers
}
