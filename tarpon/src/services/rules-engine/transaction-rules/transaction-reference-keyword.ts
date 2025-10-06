import { JSONSchemaType } from 'ajv'
import { getEditDistancePercentage } from '@flagright/lib/utils/string'
import { RuleHitResult } from '../rule'
import { LEVENSHTEIN_DISTANCE_THRESHOLD_PERCENTAGE_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'
import { traceable } from '@/core/xray'

export type TransactionReferenceKeywordRuleParameters = {
  keywords: string[]
  allowedDistancePercentage?: number
}

@traceable
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
        allowedDistancePercentage:
          LEVENSHTEIN_DISTANCE_THRESHOLD_PERCENTAGE_OPTIONAL_SCHEMA({}),
      },
      required: ['keywords'],
    }
  }

  public async computeRule() {
    if (!this.transaction.reference?.trim()) {
      return
    }

    const { keywords, allowedDistancePercentage } = this.parameters
    const referenceWords = (this.transaction.reference as string)
      .toLowerCase()
      .trim()
      .split(/\s+/)
    const referenceWordsSet = new Set(referenceWords)
    let hitWord: string | undefined = undefined
    if (allowedDistancePercentage !== undefined) {
      hitWord = referenceWords.find((refrenceWord) => {
        return keywords.find((keyword) => {
          return (
            getEditDistancePercentage(refrenceWord, keyword.toLowerCase()) <=
            allowedDistancePercentage
          )
        })
      })
    }
    hitWord =
      hitWord ??
      keywords.find((keyword) => referenceWordsSet.has(keyword.toLowerCase()))

    const hitResult: RuleHitResult = []
    if (hitWord) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          keyword: hitWord,
        },
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: {
          ...super.getTransactionVars('destination'),
          keyword: hitWord,
        },
      })
    }
    return {
      ruleHitResult: hitResult,
    }
  }
}
