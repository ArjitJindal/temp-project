import { JSONSchemaType } from 'ajv'
import { PRODUCT_TYPES_SCHEMA_OPTIONAL } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { Transaction } from '@/@types/openapi-public/Transaction'

export function transactionProductTypesRuleFilterPredicate(
  transaction: Transaction,
  productTypes?: string[]
) {
  if (productTypes == null || productTypes.length === 0) {
    return true
  }

  if (!transaction.productType) {
    return false
  }

  return productTypes.includes(transaction.productType)
}

export type TransactionProductTypesRuleFilterParameter = {
  productTypes?: string[]
}

export class TransactionProductTypesRuleFilter extends TransactionRuleFilter<TransactionProductTypesRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionProductTypesRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        productTypes: PRODUCT_TYPES_SCHEMA_OPTIONAL({
          title: 'Product types',
          description: 'Filters transaction by the product type field',
          uiSchema: {
            group: 'transaction',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }
    return transactionProductTypesRuleFilterPredicate(
      this.transaction,
      this.parameters.productTypes
    )
  }
}
