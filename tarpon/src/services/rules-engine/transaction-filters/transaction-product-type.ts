import { JSONSchemaType } from 'ajv'
import { PRODUCT_TYPE_SCHEMA_OPTIONAL } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { Transaction } from '@/@types/openapi-public/Transaction'

export function transactionProductTypeRuleFilterPredicate(
  transaction: Transaction,
  productType?: string
) {
  if (!productType || !transaction?.productType) {
    return false
  }
  return productType === transaction?.productType
}

export type TransactionProductTypeRuleFilterParameter = {
  productType?: string
}

export class TransactionProductTypeRuleFilter extends TransactionRuleFilter<TransactionProductTypeRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionProductTypeRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        productType: PRODUCT_TYPE_SCHEMA_OPTIONAL({
          title: 'Product type',
          description: 'Filters transaction by the product type field',
          uiSchema: {
            group: 'transaction',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return transactionProductTypeRuleFilterPredicate(
      this.transaction,
      this.parameters.productType
    )
  }
}
