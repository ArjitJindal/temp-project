import Ajv, { ValidateFunction } from 'ajv'
import createHttpError from 'http-errors'
import _ from 'lodash'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Rule } from '@/@types/openapi-internal/Rule'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

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

  async createOrUpdateRule(rule: Rule): Promise<Rule> {
    let validate: ValidateFunction
    try {
      validate = ajv.compile(rule.parametersSchema)
    } catch (e) {
      throw new createHttpError.BadRequest(
        'parametersSchema is not a valid json schema'
      )
    }
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

  async deleteRule(ruleId: string): Promise<void> {
    // TODO: Forbid deleting a rule if there're rule instances associating with it
    await this.ruleRepository.deleteRule(ruleId)
  }

  async getAllRuleInstances(): Promise<ReadonlyArray<RuleInstance>> {
    return this.ruleInstanceRepository.getAllRuleInstances()
  }
}
