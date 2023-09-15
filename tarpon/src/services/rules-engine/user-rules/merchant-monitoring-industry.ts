import { JSONSchemaType } from 'ajv'
import { isEmpty, isEqual } from 'lodash'
import { RuleHitResult } from '../rule'
import { isBusinessUser } from '../utils/user-rule-utils'
import { UserRule } from './rule'
import { MerchantMonitoringSourceType } from '@/@types/openapi-internal/MerchantMonitoringSourceType'
import dayjs from '@/utils/dayjs'
import { MerchantMonitoringRetrieve } from '@/services/merchant-monitoring/merchant-monitoring-retrieve'

export type MerchantMonitoringIndustryUserRuleParameters = {
  sourceType: MerchantMonitoringSourceType[]
}

const MERCHANT_SOURCE_TYPES: Array<{
  value: MerchantMonitoringSourceType
  label: string
}> = [
  { value: 'LINKEDIN', label: 'Linkedin' },
  { value: 'EXPLORIUM', label: 'Explorium' },
  { value: 'COMPANIES_HOUSE', label: 'Companies House' },
  { value: 'SCRAPE', label: 'Website scrape' },
]
export default class MerchantMonitoringIndustryUserRule extends UserRule<MerchantMonitoringIndustryUserRuleParameters> {
  public static getSchema(): JSONSchemaType<MerchantMonitoringIndustryUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        sourceType: {
          type: 'array',
          title: 'Source',
          description:
            'Select the sources from which to derive the business industry',
          items: {
            type: 'string',
            enum: MERCHANT_SOURCE_TYPES.map((v) => v.value),
            enumNames: MERCHANT_SOURCE_TYPES.map((v) => v.label),
          },
          uniqueItems: true,
        },
      },
      additionalProperties: false,
      required: ['sourceType'],
    }
  }

  public async computeRule() {
    const hitResult: RuleHitResult = []

    if (!isBusinessUser(this.user)) {
      return
    }

    if (isEmpty(this.parameters.sourceType)) {
      return hitResult
    }

    const merchantMonitoringService = new MerchantMonitoringRetrieve(
      this.tenantId,
      { mongoDb: this.mongoDb }
    )

    for (const sourceType of this.parameters.sourceType) {
      const isMerchantIndustryChanged = await this.isMerchantIndustryChanged(
        merchantMonitoringService,
        sourceType
      )

      if (isMerchantIndustryChanged) {
        hitResult.push({
          direction: 'ORIGIN',
          vars: this.getUserVars(),
        })

        break
      }
    }

    return hitResult
  }

  private async isMerchantIndustryChanged(
    merchantMonitoringService: MerchantMonitoringRetrieve,
    sourceType: MerchantMonitoringSourceType
  ): Promise<boolean> {
    const merchantMonitoringSummary =
      await merchantMonitoringService.getMerchantMonitoringHistoryBySourceType(
        sourceType,
        this.user.userId
      )

    if (merchantMonitoringSummary && !isEmpty(merchantMonitoringSummary)) {
      const merchantMonitoringSummaryBefore =
        await merchantMonitoringService.getMerchantMonitoringHistoryBySourceType(
          sourceType,
          this.user.userId,
          {
            updatedAt: {
              $lt: Math.min(
                merchantMonitoringSummary[0].updatedAt ??
                  Number.MAX_SAFE_INTEGER,
                dayjs().subtract(1, 'day').valueOf()
              ),
            },
          }
        )

      if (
        !merchantMonitoringSummaryBefore ||
        isEmpty(merchantMonitoringSummaryBefore)
      ) {
        return false
      }

      const currentIndustry = merchantMonitoringSummary[0].industry
      const previousIndustry = merchantMonitoringSummaryBefore[0].industry

      if (!isEqual(currentIndustry, previousIndustry)) {
        return true
      }
    }

    return false
  }
}
