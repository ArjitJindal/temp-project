import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { RuleFilter } from '../filter'
import { LegacyFilters } from '../filters'
import { getMigratedV8Config } from '../v8-migrations'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { UserRuleStage } from '@/@types/openapi-internal/UserRuleStage'

export abstract class UserRuleFilter<P> extends RuleFilter {
  tenantId: string
  user: User | Business
  parameters: P
  dynamoDb: DynamoDBDocumentClient
  stage: UserRuleStage

  constructor(
    tenantId: string,
    data: {
      user: User | Business
    },
    parameters: P,
    dynamoDb: DynamoDBDocumentClient,
    stage: UserRuleStage = 'INITIAL'
  ) {
    super()
    this.tenantId = tenantId
    this.user = data.user
    this.parameters = parameters
    this.dynamoDb = dynamoDb
    this.stage = stage
  }
  public async v8Runner(): Promise<boolean> {
    const migratedFilter = getMigratedV8Config(
      '',
      undefined,
      this.parameters as LegacyFilters
    )
    return (
      await new LogicEvaluator(this.tenantId, this.dynamoDb).evaluate(
        migratedFilter?.logic ?? { and: [true] },
        {},
        {
          tenantId: '',
          baseCurrency: migratedFilter?.baseCurrency,
        },
        {
          type: 'USER',
          user: this.user,
        }
      )
    ).hit
  }
}
