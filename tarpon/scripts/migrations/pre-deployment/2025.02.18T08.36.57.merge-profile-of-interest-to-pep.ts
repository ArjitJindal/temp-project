import { migrateAllTenants } from '../utils/tenant'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsSettingsProviderScreeningTypes } from '@/@types/openapi-internal/SanctionsSettingsProviderScreeningTypes'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const tenantRepository = new TenantRepository(tenantId, {
    dynamoDb,
    mongoDb,
  })
  const { sanctions } = await tenantRepository.getTenantSettings(['sanctions'])
  if (sanctions?.providerScreeningTypes) {
    const newProviderScreeningTypes: SanctionsSettingsProviderScreeningTypes[] =
      sanctions.providerScreeningTypes.filter(
        (s) => s.provider !== 'acuris' && s.provider !== 'open-sanctions'
      )
    const acurisSettings = sanctions.providerScreeningTypes.find(
      (s) => s.provider === 'acuris'
    )
    if (acurisSettings?.screeningTypes) {
      newProviderScreeningTypes.push({
        ...acurisSettings,
        screeningTypes: acurisSettings.screeningTypes.filter(
          (t) => t !== 'PROFILE_OF_INTEREST'
        ),
      })
    }
    const opensanctionSettings = sanctions.providerScreeningTypes.find(
      (s) => s.provider === 'open-sanctions'
    )
    if (opensanctionSettings?.screeningTypes) {
      newProviderScreeningTypes.push({
        ...opensanctionSettings,
        screeningTypes: opensanctionSettings.screeningTypes.filter(
          (t) => t !== 'PROFILE_OF_INTEREST'
        ),
      })
    }
    await tenantRepository.createOrUpdateTenantSettings({
      sanctions: {
        ...sanctions,
        providerScreeningTypes: newProviderScreeningTypes,
      },
    })
  }
  const now = Date.now()
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const r17s = (await ruleInstanceRepository.getAllRuleInstances()).filter(
    (r) => r.ruleId === 'R-17'
  )
  const updatedR17s = r17s.map((r) => {
    return {
      ...r,
      parameters: {
        ...r.parameters,
        screeningTypes: r.parameters.screeningTypes?.filter(
          (t) => t !== 'PROFILE_OF_INTEREST'
        ),
      },
      riskLevelParameters: removePoi(r.riskLevelParameters),
    }
  })
  await Promise.all(
    updatedR17s.map((r) =>
      ruleInstanceRepository.createOrUpdateRuleInstance(r, now)
    )
  )
}

function removePoi(riskLevelParameters) {
  for (const key of Object.keys(riskLevelParameters)) {
    riskLevelParameters[key].screeningTypes = riskLevelParameters[
      key
    ].screeningTypes.filter((type) => type !== 'PROFILE_OF_INTEREST')
  }
  return riskLevelParameters
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
