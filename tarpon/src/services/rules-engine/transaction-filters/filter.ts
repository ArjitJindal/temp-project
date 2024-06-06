import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { RuleFilter } from '../filter'
import { getMigratedV8Config } from '../v8-migrations'
import { RuleJsonLogicEvaluator } from '../v8-engine'
import { LegacyFilters } from '../filters'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Transaction } from '@/@types/openapi-public/Transaction'

export abstract class TransactionRuleFilter<P> extends RuleFilter {
  tenantId: string
  transaction: Transaction
  parameters: P
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    data: {
      transaction: Transaction
    },
    parameters: P,
    dynamoDb: DynamoDBDocumentClient
  ) {
    super()
    this.tenantId = tenantId
    this.transaction = data.transaction
    this.parameters = parameters
    this.dynamoDb = dynamoDb
  }
  public async v8Runner(): Promise<boolean> {
    const migratedFilter = getMigratedV8Config(
      '',
      undefined,
      this.parameters as LegacyFilters
    )
    return (
      await new RuleJsonLogicEvaluator('', getDynamoDbClient()).evaluate(
        migratedFilter?.logic ?? { and: [true] },
        [],
        {
          tenantId: '',
          baseCurrency: migratedFilter?.baseCurrency,
        },
        { type: 'TRANSACTION', transaction: this.transaction }
      )
    ).hit
  }
}
