import { get, keyBy, set, some, unset } from 'lodash'
import { replaceMagicKeyword } from '@flagright/lib/utils/object'
import { DEFAULT_CURRENCY_KEYWORD } from '@flagright/lib/constants/currency'
import { StackConstants } from '@lib/constants'
import { PutCommand, PutCommandInput } from '@aws-sdk/lib-dynamodb'
import { migrateAllTenants } from './tenant'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Rule } from '@/@types/openapi-internal/Rule'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { getDynamoDbClient } from '@/utils/dynamodb'
import {
  TransactionFilters,
  TransactionHistoricalFilters,
  UserFilters,
} from '@/services/rules-engine/filters'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'
import { RiskLevelRuleLogic } from '@/@types/openapi-internal/RiskLevelRuleLogic'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ruleInstanceAggregationVariablesRebuild } from '@/services/rules-engine/utils'
function isRule(rule: Rule | RuleInstance) {
  return !!(rule as Rule).defaultParameters
}

export async function getRulesById(): Promise<{ [key: string]: Rule }> {
  const dynamoDb = await getDynamoDbClient()
  const ruleRepository = new RuleRepository(FLAGRIGHT_TENANT_ID, { dynamoDb })
  const rules = await ruleRepository.getAllRules()
  return keyBy(rules, 'id')
}

export async function renameRuleParameter(
  ruleImplementationNames: string[] | undefined,
  excludedRuleImplementationNames: string[],
  oldParameterPath: string,
  newParameterPath: string,
  converterCallback: (value: any, allParameters: any) => any
) {
  await renameRuleParameterPrivate(
    ruleImplementationNames,
    excludedRuleImplementationNames,
    oldParameterPath,
    newParameterPath,
    converterCallback
  )
  await migrateAllTenants((tenant) =>
    renameRuleParameterPrivate(
      ruleImplementationNames,
      excludedRuleImplementationNames,
      oldParameterPath,
      newParameterPath,
      converterCallback,
      tenant.id
    )
  )
}

async function renameRuleParameterPrivate(
  ruleImplementationNames: string[] | undefined, //  if undefined, run for all rules
  excludedRuleImplementationNames: string[],
  oldParameterPath: string,
  newParameterPath: string,
  converterCallback: (value: any, allParameters: any) => any,
  tenantId?: string
) {
  const rulesById = await getRulesById()
  const dynamoDb = await getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const ruleRepository = tenantId
    ? new RuleInstanceRepository(tenantId, { dynamoDb })
    : new RuleRepository(FLAGRIGHT_TENANT_ID, { dynamoDb, mongoDb })
  const rules = tenantId
    ? await (ruleRepository as RuleInstanceRepository).getAllRuleInstances()
    : await (ruleRepository as RuleRepository).getAllRules()
  for (const rule of rules) {
    const ruleId = isRule(rule)
      ? (rule as Rule).id
      : (rule as RuleInstance).ruleId
    if (
      !rulesById[ruleId ?? ''] ||
      (ruleImplementationNames &&
        !ruleImplementationNames.includes(
          rulesById[ruleId ?? '']?.ruleImplementationName ?? ''
        )) ||
      excludedRuleImplementationNames.includes(
        rulesById[ruleId ?? '']?.ruleImplementationName ?? ''
      )
    ) {
      continue
    }

    let shouldSave = false
    const parameters = isRule(rule)
      ? (rule as Rule).defaultParameters
      : (rule as RuleInstance).parameters
    const targetParameter = get(parameters, oldParameterPath)
    if (targetParameter != null) {
      set(
        parameters,
        newParameterPath,
        converterCallback(targetParameter, parameters)
      )
      shouldSave = true
    }
    const riskParameters = isRule(rule)
      ? (rule as Rule).defaultRiskLevelParameters
      : (rule as RuleInstance).riskLevelParameters
    for (const risk in riskParameters || {}) {
      const targetParameter = get(
        (riskParameters as any)?.[risk],
        oldParameterPath
      )
      if (targetParameter != null) {
        set(
          (riskParameters as any)?.[risk],
          newParameterPath,
          converterCallback(targetParameter, (riskParameters as any)?.[risk])
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
  excludedRuleImplementationNames: string[],
  parameterPaths: string[]
) {
  await deleteUnusedRuleParameterPrivate(
    ruleImplementationNames,
    excludedRuleImplementationNames,
    parameterPaths
  )
  await migrateAllTenants((tenant) =>
    deleteUnusedRuleParameterPrivate(
      ruleImplementationNames,
      excludedRuleImplementationNames,
      parameterPaths,
      tenant.id
    )
  )
}

async function deleteUnusedRuleParameterPrivate(
  ruleImplementationNames: string[] | undefined,
  excludedRuleImplementationNames: string[],
  parameterPaths: string[],
  tenantId?: string
) {
  const rulesById = await getRulesById()
  const dynamoDb = await getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const ruleRepository = tenantId
    ? new RuleInstanceRepository(tenantId, { dynamoDb })
    : new RuleRepository(FLAGRIGHT_TENANT_ID, { dynamoDb, mongoDb })
  const rules = tenantId
    ? await (ruleRepository as RuleInstanceRepository).getAllRuleInstances()
    : await (ruleRepository as RuleRepository).getAllRules()
  for (const rule of rules) {
    const ruleId = isRule(rule)
      ? (rule as Rule).id
      : (rule as RuleInstance).ruleId
    if (
      !rulesById[ruleId ?? ''] ||
      (ruleImplementationNames &&
        !ruleImplementationNames.includes(
          rulesById[ruleId ?? '']?.ruleImplementationName ?? ''
        )) ||
      excludedRuleImplementationNames.includes(
        rulesById[ruleId ?? '']?.ruleImplementationName ?? ''
      )
    ) {
      continue
    }

    let shouldSave = false
    const parameters = isRule(rule)
      ? (rule as Rule).defaultParameters
      : (rule as RuleInstance).parameters

    for (const parameterPath of parameterPaths) {
      const targetParameter = get(parameters, parameterPath)
      if (targetParameter != null) {
        unset(parameters, parameterPath)
        shouldSave = true
      }
    }
    const riskParameters = isRule(rule)
      ? (rule as Rule).defaultRiskLevelParameters
      : (rule as RuleInstance).riskLevelParameters
    for (const risk in riskParameters || {}) {
      for (const parameterPath of parameterPaths) {
        const targetParameter = get(
          (riskParameters as any)?.[risk],
          parameterPath
        )
        if (targetParameter != null) {
          unset((riskParameters as any)?.[risk], parameterPath)
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

export async function addRuleFilters(
  ruleIds: string[] | undefined,
  filters: UserFilters & TransactionFilters & TransactionHistoricalFilters
) {
  await migrateAllTenants((tenant) =>
    addRuleFiltersPrivate(ruleIds, filters, tenant.id)
  )
}

async function addRuleFiltersPrivate(
  ruleIds: string[] | undefined, //  if undefined, run for all rules
  filters: UserFilters & TransactionFilters & TransactionHistoricalFilters,
  tenantId?: string
) {
  const dynamoDb = await getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const ruleRepository = tenantId
    ? new RuleInstanceRepository(tenantId, { dynamoDb })
    : new RuleRepository(FLAGRIGHT_TENANT_ID, { dynamoDb, mongoDb })
  const rules = tenantId
    ? await (ruleRepository as RuleInstanceRepository).getAllRuleInstances()
    : await (ruleRepository as RuleRepository).getAllRules()
  for (const rule of rules) {
    const ruleId = isRule(rule)
      ? (rule as Rule).id
      : (rule as RuleInstance).ruleId
    if (ruleIds && !ruleIds.includes(ruleId ?? '')) {
      continue
    }

    if (tenantId) {
      ;(rule as RuleInstance).filters = {
        ...(rule as RuleInstance).filters,
        filters,
      }
      await (
        ruleRepository as RuleInstanceRepository
      ).createOrUpdateRuleInstance(rule as RuleInstance)
    } else {
      ;(rule as Rule).defaultFilters = {
        ...(rule as Rule).defaultFilters,
        filters,
      }
      await (ruleRepository as RuleRepository).createOrUpdateRule(rule as Rule)
    }
    console.info(`Updated ${tenantId ? 'rule instance' : 'rule'} ${rule.id}`)
  }
}

export async function renameRuleFilter(
  oldParameterPath: string,
  newParameterPath: string,
  converterCallback: (value: any) => any
) {
  await migrateAllTenants((tenant) =>
    renameRuleFilterPrivate(
      oldParameterPath,
      newParameterPath,
      converterCallback,
      tenant.id
    )
  )
}

async function renameRuleFilterPrivate(
  oldParameterPath: string,
  newParameterPath: string,
  converterCallback: (value: any) => any,
  tenantId: string
) {
  const dynamoDb = await getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    let shouldSave = false
    const targetParameter = get(ruleInstance.filters, oldParameterPath)
    if (targetParameter) {
      shouldSave = true
      set(
        ruleInstance.filters,
        newParameterPath,
        converterCallback(targetParameter)
      )
    }
    if (shouldSave) {
      await ruleInstanceRepository.createOrUpdateRuleInstance(ruleInstance)
      console.info(`Updated 'rule instance' ${ruleInstance.id}`)
    }
  }
}

export async function deleteUnusedRuleFilter(parameterPaths: string[]) {
  await migrateAllTenants((tenant) =>
    deleteUnusedFilterPrivate(parameterPaths, tenant.id)
  )
}

async function deleteUnusedFilterPrivate(
  parameterPaths: string[],
  tenantId: string
) {
  const dynamoDb = await getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    let shouldSave = false
    for (const parameterPath of parameterPaths) {
      const targetParameter = get(ruleInstance.filters, parameterPath)
      if (targetParameter) {
        unset(ruleInstance.filters, parameterPath)
        shouldSave = true
      }
    }

    if (shouldSave) {
      await ruleInstanceRepository.createOrUpdateRuleInstance(ruleInstance)
      console.info(`Updated 'rule instance' ${ruleInstance.id}`)
    }
  }
}
export async function migrateRuleInstance(
  sourceRuleId: string,
  targetRuleId: string,
  converterCallback: (
    ruleInstance: RuleInstance,
    sourceRule: Rule,
    targetRule: Rule
  ) => RuleInstance
) {
  await migrateAllTenants((tenant) =>
    migrateRuleInstancePrivate(
      sourceRuleId,
      targetRuleId,
      converterCallback,
      tenant.id
    )
  )
}

function defaultRuleMigrationBehavior(
  ruleInstance: RuleInstance,
  sourceRule: Rule,
  targetRule: Rule
): RuleInstance {
  const tempRuleInstance: RuleInstance = {
    ...ruleInstance,
    ruleId: targetRule.id,
    labels: targetRule.labels,
  }

  if (ruleInstance.ruleDescriptionAlias === sourceRule.description) {
    tempRuleInstance.ruleDescriptionAlias = targetRule.description
  }

  if (ruleInstance.ruleNameAlias === sourceRule.name) {
    tempRuleInstance.ruleNameAlias = targetRule.name
  }

  return tempRuleInstance
}

async function migrateRuleInstancePrivate(
  sourceRuleId: string, // Rule Id not Rule Instance Id
  targetRuleId: string, // Rule Id not Rule Instance Id
  converterCallback: (
    ruleInstance: RuleInstance,
    sourceRule: Rule,
    targetRule: Rule
  ) => RuleInstance,
  tenantId: string
) {
  if (sourceRuleId === targetRuleId) {
    throw new Error(
      `Source rule id and target rule id cannot be the same for tenant ${tenantId}`
    )
  }

  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const tenantRepository = new TenantRepository(tenantId, {
    dynamoDb,
  })
  const sourceRule = getRuleByRuleId(sourceRuleId)
  const targetRule = getRuleByRuleId(targetRuleId)
  const tenantSettings = await tenantRepository.getTenantSettings()
  if (!sourceRule || !targetRule) {
    throw new Error(
      `Rule ${sourceRuleId} or ${targetRuleId} not found for tenant ${tenantId}`
    )
  }

  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    if (ruleInstance.ruleId === sourceRuleId) {
      const newRuleInstance = converterCallback(
        defaultRuleMigrationBehavior(ruleInstance, sourceRule, targetRule),
        sourceRule,
        targetRule
      )

      await ruleInstanceRepository.createOrUpdateRuleInstance(
        replaceMagicKeyword(
          newRuleInstance,
          DEFAULT_CURRENCY_KEYWORD,
          tenantSettings?.defaultValues?.currency ?? 'USD'
        ) as RuleInstance
      )
      console.info(`Updated 'rule instance' ${ruleInstance.id}`)
    }
  }
}

export const deleteRules = async (ruleIds: string[]) => {
  const dynamoDb = getDynamoDbClient()
  const tenantId = FLAGRIGHT_TENANT_ID
  const ruleRepository = new RuleRepository(tenantId, {
    dynamoDb,
  })

  await Promise.all(
    ruleIds.map(async (ruleId) => {
      await ruleRepository.deleteRule(ruleId)
      console.info(`Deleted 'rule' ${ruleId}`)
    })
  )
}

export const replaceMagicKeywordInLogic = <T>(
  keyword: string,
  replacement: string,
  input: object,
  type: 'var' | 'func' | 'op'
): T => {
  if (typeof input !== 'object' || input === null) {
    return input
  }

  if (Array.isArray(input)) {
    return input.map((item) =>
      replaceMagicKeywordInLogic(keyword, replacement, item, type)
    ) as any
  }
  const newObject: Record<string, any> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && type === 'var' && value === keyword) {
      newObject[key] = replacement
      continue
    }
    const newKey = type === 'var' || key !== keyword ? key : replacement

    newObject[newKey] = replaceMagicKeywordInLogic(
      keyword,
      replacement,
      value,
      type
    )
  }

  return newObject as T
}

export const renameV8KeyForTenant = async (
  oldKey: string,
  newKey: string,
  type: 'var' | 'func' | 'op',
  tenantId: string
) => {
  const dynamoDb = getDynamoDbClient()
  const ruleRepository = new RuleInstanceRepository(tenantId, { dynamoDb })
  const ruleInstances = await (
    ruleRepository as RuleInstanceRepository
  ).getAllRuleInstances()

  for (const ruleInstance of ruleInstances) {
    ruleInstance.logic = replaceMagicKeywordInLogic(
      oldKey,
      newKey,
      ruleInstance.logic,
      type
    )
    ruleInstance.riskLevelLogic = Object.keys(
      ruleInstance?.riskLevelLogic ?? {}
    ).reduce((acc, riskLevel) => {
      return {
        ...acc,
        [riskLevel]: replaceMagicKeywordInLogic(
          oldKey,
          newKey,
          ruleInstance.riskLevelLogic?.[riskLevel],
          type
        ),
      }
    }, {}) as RiskLevelRuleLogic
    if (type === 'var') {
      ruleInstance.logicEntityVariables =
        ruleInstance.logicEntityVariables?.map((entityVar) => ({
          ...entityVar,
          key: newKey,
        }))
      ruleInstance.logicAggregationVariables =
        ruleInstance.logicAggregationVariables?.map((aggVar) => {
          return {
            ...aggVar,
            aggregationFieldKey: newKey,
            filtersLogic: replaceMagicKeywordInLogic(
              oldKey,
              newKey,
              aggVar.filtersLogic,
              type
            ),
          }
        })
    }
    await (ruleRepository as RuleInstanceRepository).createOrUpdateRuleInstance(
      ruleInstance
    )
  }
}

export const renameV8Key = async (
  oldKey: string,
  newKey: string,
  type: 'var' | 'func' | 'op'
) => {
  await migrateAllTenants(async (tenant) => {
    await renameV8KeyForTenant(oldKey, newKey, type, tenant.id)
  })
}

export async function bumpLogicAggregationVariablesVersion(
  tenantId: string,
  toUpdateCallback: (
    LogicAggregationVariable: LogicAggregationVariable
  ) => boolean
) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const activeTransactionRuleInstances =
    await ruleInstanceRepository.getActiveRuleInstances('TRANSACTION')
  const activeUserRuleInstances =
    await ruleInstanceRepository.getActiveRuleInstances('USER')
  const activeRuleInstances = [
    ...activeTransactionRuleInstances,
    ...activeUserRuleInstances,
  ]
  for (const ruleInstance of activeRuleInstances) {
    if (
      ruleInstance.logicAggregationVariables &&
      some(ruleInstance.logicAggregationVariables ?? [], toUpdateCallback)
    ) {
      const newVersion = Date.now()
      ruleInstance.logicAggregationVariables =
        ruleInstance.logicAggregationVariables.map((aggVar) => {
          if (toUpdateCallback(aggVar)) {
            return {
              ...aggVar,
              version: newVersion,
            }
          }
          return aggVar
        })
      const putItemInput: PutCommandInput = {
        TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
        Item: {
          ...DynamoDbKeys.RULE_INSTANCE(tenantId, ruleInstance.id),
          ...ruleInstance,
        },
      }
      await dynamoDb.send(new PutCommand(putItemInput))
      await ruleInstanceAggregationVariablesRebuild(
        ruleInstance,
        newVersion,
        tenantId,
        ruleInstanceRepository
      )
    }
  }
}
