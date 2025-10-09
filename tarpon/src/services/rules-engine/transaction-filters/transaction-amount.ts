import { JSONSchemaType } from 'ajv'

import isEmpty from 'lodash/isEmpty'
import { DEFAULT_CURRENCY_KEYWORD } from '@flagright/lib/constants/currency'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { TRANSACTION_AMOUNT_RANGE_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { TransactionRuleFilter } from './filter'
import { TransactionAmountRange } from '@/@types/rule/params'
import { Transaction } from '@/@types/openapi-public/Transaction'

export async function transactionAmountRuleFilterPredicate(
  transaction: Transaction,
  dynamoDb: DynamoDBDocumentClient,
  transactionAmountRange?: TransactionAmountRange
) {
  if (!transactionAmountRange || isEmpty(transactionAmountRange)) {
    return true
  }

  const isOriginAmountInRange = await checkTransactionAmountBetweenThreshold(
    transaction.originAmountDetails,
    transactionAmountRange,
    dynamoDb
  )
  const isDestinationAmountInRange =
    await checkTransactionAmountBetweenThreshold(
      transaction.destinationAmountDetails,
      transactionAmountRange,
      dynamoDb
    )
  return Boolean(isOriginAmountInRange || isDestinationAmountInRange)
}

export type TransactionAmountRuleFilterParameter = {
  transactionAmountRange?: TransactionAmountRange
}

export class TransactionAmountRuleFilter extends TransactionRuleFilter<TransactionAmountRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionAmountRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionAmountRange: TRANSACTION_AMOUNT_RANGE_OPTIONAL_SCHEMA({
          uiSchema: {
            group: 'transaction',
          },
        }),
      },
    }
  }

  public static getDefaultValues(): TransactionAmountRuleFilterParameter {
    return {
      transactionAmountRange: {
        [DEFAULT_CURRENCY_KEYWORD]: {},
      },
    }
  }

  public async predicate(): Promise<boolean> {
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }
    return transactionAmountRuleFilterPredicate(
      this.transaction,
      this.dynamoDb,
      this.parameters.transactionAmountRange
    )
  }
}
