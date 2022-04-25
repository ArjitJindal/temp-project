import Ajv, { ValidateFunction } from 'ajv'
import createHttpError from 'http-errors'
import _ from 'lodash'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Rule } from '@/@types/openapi-internal/Rule'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleImplementation } from '@/@types/openapi-internal/RuleImplementation'
import { rules } from '@/services/rules-engine/rules'

const ajv = new Ajv()
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

  async getAllRules(): Promise<ReadonlyArray<Rule>> {
    return this.ruleRepository.getAllRules()
  }

  getAllRuleImplementations(): ReadonlyArray<RuleImplementation> {
    return Object.entries(rules)
      .filter((entry) => !entry[0].startsWith('tests/'))
      .map((entry) => ({
        name: entry[0],
        parametersSchema: entry[1].getSchema(),
      }))
  }

  async createOrUpdateRule(rule: Rule): Promise<Rule> {
    const validate: ValidateFunction = ajv.compile(
      rules[rule.ruleImplementationName].getSchema()
    )
    if (validate(rule.defaultParameters)) {
      return this.ruleRepository.createOrUpdateRule(rule)
    } else {
      throw new createHttpError.BadRequest(
        `Invalid defaultParameters: ${validate.errors
          ?.map((error) => error.message)
          .join(', ')}`
      )
    }
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

    const validate: ValidateFunction = ajv.compile(
      rules[rule.ruleImplementationName].getSchema()
    )
    if (validate(ruleInstance.parameters)) {
      return this.ruleInstanceRepository.createOrUpdateRuleInstance(
        ruleInstance
      )
    } else {
      throw new createHttpError.BadRequest(
        `Invalid parameters: ${validate.errors
          ?.map((error) => error.message)
          .join(', ')}`
      )
    }
  }

  async deleteRule(ruleId: string): Promise<void> {
    // TODO: Forbid deleting a rule if there're rule instances associating with it
    await this.ruleRepository.deleteRule(ruleId)
  }

  async getAllRuleInstances(): Promise<ReadonlyArray<RuleInstance>> {
    return this.ruleInstanceRepository.getAllRuleInstances()
  }
}
