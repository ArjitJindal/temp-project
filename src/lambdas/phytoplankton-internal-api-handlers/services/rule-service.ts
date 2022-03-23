import Ajv, { ValidateFunction } from 'ajv'
import createHttpError from 'http-errors'
import { Rule } from '../../../@types/openapi-internal/Rule'
import { RuleRepository } from '../../rules-engine/repositories/rule-repository'

const ajv = new Ajv()
export class RuleService {
  ruleRepository: RuleRepository

  constructor(ruleRepository: RuleRepository) {
    this.ruleRepository = ruleRepository
  }

  async getRules(): Promise<ReadonlyArray<Rule>> {
    return this.ruleRepository.getRules()
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
}
