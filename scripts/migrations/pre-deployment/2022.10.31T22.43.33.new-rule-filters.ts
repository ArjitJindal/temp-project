import _ from 'lodash'
import { addRuleFilters } from '../utils/rule'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

function removeEmpty(obj: any) {
  return Object.fromEntries(
    Object.entries(obj).filter((entry) => !_.isEmpty(entry[1]))
  )
}

async function migrateOldFiltersForTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const ruleRepository = new RuleInstanceRepository(tenant.id, { dynamoDb })
  const ruleInstances = await (
    ruleRepository as RuleInstanceRepository
  ).getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    let filterKeys = [
      'transactionTypes',
      'transactionState',
      'userType',
      'paymentMethod',
      'ageRange',
    ]
    if (ruleInstance.ruleId === 'R-101') {
      // transactionTypes in R-101 is a required rule parameter
      filterKeys = filterKeys.filter((key) => key !== 'transactionTypes')
    } else if (ruleInstance.ruleId === 'R-125') {
      // transactionState in R-125 is a required rule parameter
      filterKeys = filterKeys.filter((key) => key !== 'transactionState')
    }
    const filters = _.pick(ruleInstance.parameters, filterKeys)
    const riskParameters = ruleInstance.riskLevelParameters
    let prevRiskFilters = null
    for (const risk in riskParameters || {}) {
      const riskFilters = removeEmpty(
        _.pick((riskParameters as any)?.[risk], filterKeys)
      )
      if (prevRiskFilters && !_.isEqual(prevRiskFilters, riskFilters)) {
        console.error('Pref:', prevRiskFilters)
        console.error('Current:', riskFilters)
        throw new Error(
          `Filters in the risk level parameters are not the same - ${ruleInstance.ruleId} (${ruleInstance.id})`
        )
      }
      const newRiskParameters = _.omit(
        (riskParameters as any)?.[risk],
        filterKeys
      )

      prevRiskFilters = riskFilters
      ;(riskParameters as any)[risk] = newRiskParameters
    }
    if (!_.isEmpty(filters) || !_.isEmpty(prevRiskFilters)) {
      const newFilters: any = prevRiskFilters ?? filters
      if (newFilters?.ageRange) {
        if (newFilters?.ageRange.minAge != null) {
          newFilters.ageRange.minAge = {
            units: newFilters?.ageRange.minAge,
            granularity: 'year',
          }
        }
        if (newFilters?.ageRange.maxAge != null) {
          newFilters.ageRange.maxAge = {
            units: newFilters?.ageRange.maxAge,
            granularity: 'year',
          }
        }
        newFilters.userAgeRange = newFilters.ageRange
        newFilters.ageRange = undefined
      }

      await (
        ruleRepository as RuleInstanceRepository
      ).createOrUpdateRuleInstance({
        ...ruleInstance,
        filters: newFilters,
      })
      console.info(`Updated rule instance ${ruleInstance.id}`)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateOldFiltersForTenant)
  await addRuleFilters(['R-22', 'R-53', 'R-54', 'R-114', 'R-118'], {
    paymentMethod: 'CARD',
  })
  await addRuleFilters(['R-13'], { paymentMethod: 'WALLET' })
  await addRuleFilters(['R-118'], { userType: 'CONSUMER' })
}

export const down = async () => {
  // Put your migration code for rolling back here. If not applicable, skip it.
}
