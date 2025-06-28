import { FlatFileRunner } from './index'
import { isV2RuleInstance } from '@/services/rules-engine/utils'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { FlatFileValidationResult } from '@/@types/flat-files'
import { RuleInstanceService } from '@/services/rules-engine/rule-instance-service'

export class RulesImportRunner extends FlatFileRunner<RuleInstance> {
  model = RuleInstance
  public concurrency = 10

  protected async _run(data: RuleInstance): Promise<void> {
    const ruleService = new RuleInstanceService(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })

    const v2Rule = isV2RuleInstance(data)

    delete data.createdAt
    delete data.updatedAt
    delete data.id
    delete data.hitCount
    delete data.runCount

    if (!v2Rule) {
      delete data.ruleId
    }

    await ruleService.createOrUpdateRuleInstance(data)
  }

  async validate(): Promise<
    Pick<FlatFileValidationResult, 'valid' | 'errors'>
  > {
    return {
      valid: true,
      errors: [],
    }
  }
}
