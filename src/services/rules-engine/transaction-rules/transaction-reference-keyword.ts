import { JSONSchemaType } from 'ajv'
import * as levenshtein from 'fast-levenshtein'
import { TransactionRule } from './rule'

export type TransactionReferenceKeywordRuleParameters = {
  keywords: string[]
  allowedDistance?: number
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
        allowedDistance: {
          type: 'integer',
          title:
            'Maximum number of single-character edits (Levenshtein distance)',
          nullable: true,
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
    const { keywords, allowedDistance } = this.parameters
    const referenceWords = (this.transaction.reference as string)
      .toLowerCase()
      .trim()
      .split(/\s+/)
    const referenceWordsSet = new Set(referenceWords)
    if (allowedDistance != undefined) {
      const hitWord = referenceWords.find((refrenceWord) => {
        return keywords.find((keyword) => {
          return (
            levenshtein.get(refrenceWord, keyword.toLowerCase()) <=
            allowedDistance
          )
        })
      })
      if (hitWord) {
        return { action: this.action }
      }
    }
    if (
      keywords.find((keyword) => referenceWordsSet.has(keyword.toLowerCase()))
    ) {
      return { action: this.action }
    }
  }
}
