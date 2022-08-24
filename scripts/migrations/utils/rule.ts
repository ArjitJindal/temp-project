import _ from 'lodash'
import { getDynamoDbClient } from './db'
import { migrateAllTenants } from './tenant'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Rule } from '@/@types/openapi-internal/Rule'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

function isRule(rule: Rule | RuleInstance) {
  return !!(rule as Rule).defaultParameters
}

async function getRulesById(): Promise<{ [key: string]: Rule }> {
  const dynamoDb = await getDynamoDbClient()
  const ruleRepository = new RuleRepository(FLAGRIGHT_TENANT_ID, { dynamoDb })
  const rules = await ruleRepository.getAllRules()
  return _.keyBy(rules, 'id')
}

export async function renameRuleParameter(
  ruleImplementationNames: string[] | undefined,
  oldParameterPath: string,
  newParameterPath: string,
  converterCallback: (value: any) => any
) {
  await renameRuleParameterPrivate(
    ruleImplementationNames,
    oldParameterPath,
    newParameterPath,
    converterCallback
  )
  await migrateAllTenants((tenant) =>
    renameRuleParameterPrivate(
      ruleImplementationNames,
      oldParameterPath,
      newParameterPath,
      converterCallback,
      tenant.id
    )
  )
}

async function renameRuleParameterPrivate(
  ruleImplementationNames: string[] | undefined, //  if undefined, run for all rules
  oldParameterPath: string,
  newParameterPath: string,
  converterCallback: (value: any) => any,
  tenantId?: string
) {
  const rulesById = await getRulesById()
  const dynamoDb = await getDynamoDbClient()
  const ruleRepository = tenantId
    ? new RuleInstanceRepository(tenantId, { dynamoDb })
    : new RuleRepository(FLAGRIGHT_TENANT_ID, { dynamoDb })
  const rules = tenantId
    ? await (ruleRepository as RuleInstanceRepository).getAllRuleInstances()
    : await (ruleRepository as RuleRepository).getAllRules()
  for (const rule of rules) {
    const ruleId = isRule(rule)
      ? (rule as Rule).id
      : (rule as RuleInstance).ruleId
    if (
      ruleImplementationNames &&
      !ruleImplementationNames.includes(
        rulesById[ruleId].ruleImplementationName
      )
    ) {
      continue
    }

    let shouldSave = false
    const parameters = isRule(rule)
      ? (rule as Rule).defaultParameters
      : (rule as RuleInstance).parameters
    const targetParameter = _.get(parameters, oldParameterPath)
    if (targetParameter) {
      _.set(parameters, newParameterPath, converterCallback(targetParameter))
      shouldSave = true
    }
    const riskParameters = isRule(rule)
      ? (rule as Rule).defaultRiskLevelParameters
      : (rule as RuleInstance).riskLevelParameters
    for (const risk in riskParameters || {}) {
      const targetParameter = _.get(
        (riskParameters as any)?.[risk],
        oldParameterPath
      )
      if (targetParameter) {
        _.set(
          (riskParameters as any)?.[risk],
          newParameterPath,
          converterCallback(targetParameter)
        )
        shouldSave = true
      }
    }
    if (shouldSave) {
      console.info(`Updated ${tenantId ? 'rule instance' : 'rule'} ${rule.id}`)
      if (tenantId) {
        await (
          ruleRepository as RuleInstanceRepository
        ).createOrUpdateRuleInstance(rule as RuleInstance)
      } else {
        await (ruleRepository as RuleRepository).createOrUpdateRule(
          rule as Rule
        )
      }
    }
  }
}

export async function deleteUnusedRuleParameter(
  ruleImplementationNames: string[] | undefined, // if undefined, run for all rules
  parameterPaths: string[]
) {
  await deleteUnusedRuleParameterPrivate(
    ruleImplementationNames,
    parameterPaths
  )
  await migrateAllTenants((tenant) =>
    deleteUnusedRuleParameterPrivate(
      ruleImplementationNames,
      parameterPaths,
      tenant.id
    )
  )
}

async function deleteUnusedRuleParameterPrivate(
  ruleImplementationNames: string[] | undefined,
  parameterPaths: string[],
  tenantId?: string
) {
  const rulesById = await getRulesById()
  const dynamoDb = await getDynamoDbClient()
  const ruleRepository = tenantId
    ? new RuleInstanceRepository(tenantId, { dynamoDb })
    : new RuleRepository(FLAGRIGHT_TENANT_ID, { dynamoDb })
  const rules = tenantId
    ? await (ruleRepository as RuleInstanceRepository).getAllRuleInstances()
    : await (ruleRepository as RuleRepository).getAllRules()
  for (const rule of rules) {
    const ruleId = isRule(rule)
      ? (rule as Rule).id
      : (rule as RuleInstance).ruleId
    if (
      ruleImplementationNames &&
      !ruleImplementationNames.includes(
        rulesById[ruleId].ruleImplementationName
      )
    ) {
      continue
    }

    let shouldSave = false
    const parameters = isRule(rule)
      ? (rule as Rule).defaultParameters
      : (rule as RuleInstance).parameters

    for (const parameterPath of parameterPaths) {
      const targetParameter = _.get(parameters, parameterPath)
      if (targetParameter) {
        _.unset(parameters, parameterPath)
        shouldSave = true
      }
    }
    const riskParameters = isRule(rule)
      ? (rule as Rule).defaultRiskLevelParameters
      : (rule as RuleInstance).riskLevelParameters
    for (const risk in riskParameters || {}) {
      for (const parameterPath of parameterPaths) {
        const targetParameter = _.get(
          (riskParameters as any)?.[risk],
          parameterPath
        )
        if (targetParameter) {
          _.unset((riskParameters as any)?.[risk], parameterPath)
          shouldSave = true
        }
      }
    }
    if (shouldSave) {
      console.info(`Updated ${tenantId ? 'rule instance' : 'rule'} ${rule.id}`)
      if (tenantId) {
        await (
          ruleRepository as RuleInstanceRepository
        ).createOrUpdateRuleInstance(rule as RuleInstance)
      } else {
        await (ruleRepository as RuleRepository).createOrUpdateRule(
          rule as Rule
        )
      }
    }
  }
}
