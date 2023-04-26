import Ajv, { ValidateFunction } from 'ajv'
import createHttpError from 'http-errors'
import _ from 'lodash'
import { DEFAULT_CURRENCY_KEYWORD } from './transaction-rules/library'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Rule } from '@/@types/openapi-internal/Rule'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { TRANSACTION_RULES } from '@/services/rules-engine/transaction-rules'
import { USER_RULES } from '@/services/rules-engine/user-rules'
import { RiskLevelRuleParameters } from '@/@types/openapi-internal/RiskLevelRuleParameters'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RiskLevelRuleActions } from '@/@types/openapi-internal/RiskLevelRuleActions'
import { replaceMagicKeyword } from '@/utils/objectUtils'
import { hasFeatures } from '@/core/utils/context'

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

  async getAllRules(): Promise<Array<Rule>> {
    let rules = await this.ruleRepository.getAllRules()

    const tenantRepo = new TenantRepository(
      this.ruleInstanceRepository.tenantId,
      { dynamoDb: this.ruleInstanceRepository.dynamoDb }
    )

    const tenantSettings = await tenantRepo.getTenantSettings()

    rules = replaceMagicKeyword(
      rules,
      DEFAULT_CURRENCY_KEYWORD,
      tenantSettings?.defaultValues?.currency ?? 'USD'
    ) as Array<Rule>

    return rules.filter(
      (rule) =>
        _.isEmpty(rule.requiredFeatures) ||
        hasFeatures(rule.requiredFeatures || [])
    )
  }

  async createOrUpdateRule(rule: Rule): Promise<Rule> {
    this.assertValidRiskLevelParameters(
      rule.defaultRiskLevelActions,
      rule.defaultRiskLevelParameters
    )
    RuleService.validateRuleParametersSchema(
      ALL_RULES[rule.ruleImplementationName].getSchema(),
      rule.defaultParameters,
      rule.defaultRiskLevelParameters
    )
    return this.ruleRepository.createOrUpdateRule(rule)
  }

  async createOrUpdateRuleInstance(
    ruleInstance: RuleInstance
  ): Promise<RuleInstance> {
    const rule = await this.ruleRepository.getRuleById(ruleInstance.ruleId)
    if (!rule) {
      throw new createHttpError.BadRequest(
        `Rule ID ${ruleInstance.ruleId} not found`
      )
    }

    this.assertValidRiskLevelParameters(
      ruleInstance.riskLevelActions,
      ruleInstance.riskLevelParameters
    )
    RuleService.validateRuleParametersSchema(
      ALL_RULES[rule.ruleImplementationName].getSchema(),
      ruleInstance.parameters,
      ruleInstance.riskLevelParameters
    )
    return this.ruleInstanceRepository.createOrUpdateRuleInstance({
      ...ruleInstance,
      type: rule.type,
    })
  }

  async deleteRule(ruleId: string): Promise<void> {
    // TODO: Forbid deleting a rule if there're rule instances associating with it
    await this.ruleRepository.deleteRule(ruleId)
  }

  async getAllRuleInstances(): Promise<ReadonlyArray<RuleInstance>> {
    return this.ruleInstanceRepository.getAllRuleInstances()
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
