import Ajv, { ValidateFunction } from 'ajv'
import createHttpError from 'http-errors'
import { removeStopwords, eng } from 'stopword'
import { isEmpty, set } from 'lodash'
import { replaceMagicKeyword } from '@flagright/lib/utils/object'
import { DEFAULT_CURRENCY_KEYWORD } from '@flagright/lib/constants/currency'
import { RULES_LIBRARY } from './transaction-rules/library'
import {
  TRANSACTION_FILTERS,
  TRANSACTION_FILTER_DEFAULT_VALUES,
  TRANSACTION_HISTORICAL_FILTERS,
  USER_FILTERS,
} from './filters'
import { isV8Rule, isV8RuleInstance } from './utils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Rule, RuleTypeEnum } from '@/@types/openapi-internal/Rule'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { TRANSACTION_RULES } from '@/services/rules-engine/transaction-rules'
import { USER_RULES } from '@/services/rules-engine/user-rules'
import { RiskLevelRuleParameters } from '@/@types/openapi-internal/RiskLevelRuleParameters'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RiskLevelRuleActions } from '@/@types/openapi-internal/RiskLevelRuleActions'
import { mergeObjects } from '@/utils/object'
import { hasFeatures, tenantSettings } from '@/core/utils/context'
import { traceable } from '@/core/xray'
import { RuleFilters } from '@/@types/openapi-internal/RuleFilters'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { RuleSearchFilter } from '@/@types/rule/rule-actions'
import { removePunctuation } from '@/utils/regex'

const RISK_LEVELS = RiskLevelRuleParameters.attributeTypeMap.map(
  (attribute) => attribute.name
) as Array<RiskLevel>

const ALL_RULES = {
  ...TRANSACTION_RULES,
  ...USER_RULES,
}

const ajv = new Ajv()
ajv.addKeyword('ui:schema')
ajv.addKeyword('enumNames')

@traceable
export class RuleService {
  ruleRepository: RuleRepository
  ruleInstanceRepository: RuleInstanceRepository

  constructor(
    ruleRepository: RuleRepository,
    ruleInstanceRepository: RuleInstanceRepository
  ) {
    this.ruleRepository = ruleRepository
    this.ruleInstanceRepository = ruleInstanceRepository
  }

  public static async syncRulesLibrary() {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const ruleRepository = new RuleRepository(FLAGRIGHT_TENANT_ID, {
      dynamoDb,
      mongoDb,
    })
    for (const rule of RULES_LIBRARY) {
      console.info(`Syncing rule ${rule.id} (${rule.name})`)
      // If ui:order is not defined, set the order to be the order defined in each rule
      if (!rule.parametersSchema?.['ui:schema']?.['ui:order']) {
        set(
          rule.parametersSchema,
          `ui:schema.ui:order`,
          Object.keys(rule.parametersSchema.properties)
        )
      }
      await ruleRepository.createOrUpdateRule(rule)
      console.info(`Synced rule ${rule.id} (${rule.name})`)
    }
    console.info('All rules synced')
    dynamoDb.destroy()
    void mongoDb.close()
  }

  async getAllRuleFilters(): Promise<RuleFilters> {
    const mongoDb = await getMongoDbClient()
    const tenantRepository = new TenantRepository(
      this.ruleRepository.tenantId,
      { mongoDb, dynamoDb: this.ruleRepository.dynamoDb }
    )

    const filters = [
      ...Object.values(USER_FILTERS),
      ...Object.values(TRANSACTION_FILTERS),
      ...Object.values(TRANSACTION_HISTORICAL_FILTERS),
    ].map((filterClass) => (filterClass.getSchema() as any)?.properties || {})

    const defaultValues = [
      ...Object.values(TRANSACTION_FILTER_DEFAULT_VALUES),
    ].map((defaultValue) => {
      if (defaultValue && defaultValue?.getDefaultValues instanceof Function) {
        return defaultValue.getDefaultValues()
      }
    })
    const tenantSettings = await tenantRepository.getTenantSettings()
    const defaultCurrency = tenantSettings?.defaultValues?.currency
    const mergedFilters = mergeObjects({}, ...filters)

    return {
      schema: {
        type: 'object',
        properties: mergedFilters,
        'ui:schema': {
          'ui:order': Object.keys(mergedFilters),
        },
      },
      defaultValues: replaceMagicKeyword(
        mergeObjects({}, ...defaultValues),
        DEFAULT_CURRENCY_KEYWORD,
        defaultCurrency ?? 'USD'
      ),
    } as RuleFilters
  }

  public async deleteRuleInstance(ruleInstanceId: string): Promise<void> {
    await this.ruleInstanceRepository.deleteRuleInstance(ruleInstanceId)
  }

  async getAllRules(): Promise<Array<Rule>> {
    const rulesPromise = this.ruleRepository.getAllRules()

    const settings = await tenantSettings(this.ruleInstanceRepository.tenantId)

    const rules = replaceMagicKeyword(
      await rulesPromise,
      DEFAULT_CURRENCY_KEYWORD,
      settings?.defaultValues?.currency ?? 'USD'
    ) as Array<Rule>

    return rules.filter(
      (rule) =>
        isEmpty(rule.requiredFeatures) ||
        hasFeatures(rule.requiredFeatures || [])
    )
  }

  async searchRules(
    queryStr: string,
    filters: RuleSearchFilter
  ): Promise<Rule[]> {
    const cleanedQueryStr = removePunctuation(
      removeStopwords(queryStr.split(' '), [...eng, 'rule']).join(' ')
    )

    return this.ruleRepository.searchRules(cleanedQueryStr, filters)
  }

  async createOrUpdateRule(rule: Rule): Promise<Rule> {
    if (!isV8Rule(rule)) {
      this.assertValidRiskLevelParameters(
        rule.defaultRiskLevelActions,
        rule.defaultRiskLevelParameters
      )
      RuleService.validateRuleParametersSchema(
        ALL_RULES[rule.ruleImplementationName!].getSchema(),
        rule.defaultParameters,
        rule.defaultRiskLevelParameters
      )
    }
    return this.ruleRepository.createOrUpdateRule(rule)
  }

  async createOrUpdateRuleInstance(
    ruleInstance: RuleInstance
  ): Promise<RuleInstance> {
    const rule = ruleInstance.ruleId
      ? await this.ruleRepository.getRuleById(ruleInstance.ruleId)
      : null
    if (!isV8RuleInstance(ruleInstance) && !rule) {
      throw new createHttpError.BadRequest(
        `Rule ID ${ruleInstance.ruleId} not found`
      )
    }

    if (!isV8RuleInstance(ruleInstance)) {
      this.assertValidRiskLevelParameters(
        ruleInstance.riskLevelActions,
        ruleInstance.riskLevelParameters
      )
      RuleService.validateRuleParametersSchema(
        ALL_RULES[rule!.ruleImplementationName!].getSchema(),
        ruleInstance.parameters,
        ruleInstance.riskLevelParameters
      )
    }
    // TODO (V8): FR-3985
    const type = rule ? rule.type : 'TRANSACTION'
    return this.ruleInstanceRepository.createOrUpdateRuleInstance({
      ...ruleInstance,
      type,
    })
  }

  async deleteRule(ruleId: string): Promise<void> {
    // TODO: Forbid deleting a rule if there're rule instances associating with it
    await this.ruleRepository.deleteRule(ruleId)
  }

  async getAllRuleInstances(): Promise<RuleInstance[]> {
    return this.ruleInstanceRepository.getAllRuleInstances()
  }

  async getActiveRuleInstances(
    type: RuleTypeEnum
  ): Promise<ReadonlyArray<RuleInstance>> {
    return this.ruleInstanceRepository.getActiveRuleInstances(type)
  }

  private assertValidRiskLevelParameters(
    riskLevelRuleActions?: RiskLevelRuleActions,
    riskLevelRuleParameters?: RiskLevelRuleParameters
  ) {
    if (
      (!riskLevelRuleActions && riskLevelRuleParameters) ||
      (riskLevelRuleActions && !riskLevelRuleParameters)
    ) {
      throw new createHttpError.BadRequest(
        'Risk-level rule actions and risk-level rule parameters should coexist'
      )
    }
  }

  public static validateRuleParametersSchema(
    schema: object,
    parameters: object,
    riskLevelParameters?: RiskLevelRuleParameters
  ) {
    if (riskLevelParameters) {
      for (const riskLevel of RISK_LEVELS) {
        const validate: ValidateFunction = ajv.compile(schema)
        if (!validate(riskLevelParameters[riskLevel])) {
          throw new createHttpError.BadRequest(
            `Invalid ${riskLevel} risk-level parameters: ${validate.errors
              ?.map((error) => error.message)
              .join(', ')}`
          )
        }
      }
      return
    } else {
      const validate: ValidateFunction = ajv.compile(schema)
      if (validate(parameters)) {
        return
      } else {
        throw new createHttpError.BadRequest(
          `Invalid parameters: ${validate.errors
            ?.map((error) => error.message)
            .join(', ')}`
        )
      }
    }
  }
}
