import { JSONSchemaType } from 'ajv'
import { TransactionRule } from './rule'

export type TransactionReferenceKeywordRuleParameters = {
  keywords: string[]
}

export default class TransactionReferenceKeywordRule extends TransactionRule<TransactionReferenceKeywordRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionReferenceKeywordRuleParameters> {
    return {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          title: 'Keywords',
          items: { type: 'string' },
        },
      },
      required: ['keywords'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    return [
      () =>
        this.transaction.reference !== undefined &&
        this.transaction.reference.trim() !== '',
    ]
  }

  public async computeRule() {
    const { keywords } = this.parameters
    const referenceWords = new Set(
      (this.transaction.reference as string).toLowerCase().trim().split(/\s+/)
    )

    if (keywords.find((keyword) => referenceWords.has(keyword.toLowerCase()))) {
      return { action: this.action }
    }
  }
}
