import { JSONSchemaType } from 'ajv'
import { isEmpty, isEqual } from 'lodash'
import { Filter } from 'mongodb'
import { RuleHitResult } from '../rule'
import { isBusinessUser } from '../utils/user-rule-utils'
import { UserRule } from './rule'
import { MerchantMonitoringSourceType } from '@/@types/openapi-internal/MerchantMonitoringSourceType'
import dayjs from '@/utils/dayjs'
import { MerchantMonitoringRetrieve } from '@/services/merchant-monitoring/merchant-monitoring-retrieve'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { MerchantMonitoringSource } from '@/@types/openapi-internal/MerchantMonitoringSource'
import { Business } from '@/@types/openapi-internal/Business'

export type MerchantMonitoringIndustryUserRuleParameters = {
  sourceType: MerchantMonitoringSourceType[]
}

const MERCHANT_SOURCE_TYPES: Array<{
  value: MerchantMonitoringSourceType
  label: string
}> = [
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
      return
    }

    const allSources: MerchantMonitoringSource[] = []
    const user = this.user as Business

    for (const sourceType of this.parameters.sourceType) {
      switch (sourceType) {
        case 'EXPLORIUM':
        case 'COMPANIES_HOUSE': {
          allSources.push({
            sourceType,
          })

          break
        }

        case 'SCRAPE': {
          const websites = user.legalEntity.contactDetails?.websites ?? []
          for (const website of websites) {
            allSources.push({
              sourceType,
              sourceValue: website,
            })
          }

          break
        }
      }
    }

    const merchantMonitoringService = new MerchantMonitoringRetrieve(
      this.tenantId,
      { mongoDb: this.mongoDb }
    )

    let changedSource: MerchantMonitoringSource | undefined

    for await (const source of allSources) {
      const isIndustryChanged = await this.isMerchantIndustryChanged(
        merchantMonitoringService,
        source
      )

      if (isIndustryChanged) {
        changedSource = source
        break
      }
    }

    if (changedSource) {
      hitResult.push({
        vars: {
          ...this.getUserVars(),
          sourceType:
            changedSource.sourceType === 'SCRAPE'
              ? changedSource.sourceValue
              : changedSource.sourceType,
        },
        direction: 'ORIGIN',
      })
    }

    if (!isEmpty(hitResult)) {
      return hitResult
    }

    return
  }

  private async isMerchantIndustryChanged(
    merchantMonitoringService: MerchantMonitoringRetrieve,
    source: MerchantMonitoringSource
  ): Promise<boolean> {
    const merchantMonitoringSummary =
      await merchantMonitoringService.getMerchantMonitoringHistory(
        source,
        this.user.userId,
        undefined,
        1
      )

    if (merchantMonitoringSummary && !isEmpty(merchantMonitoringSummary)) {
      const merchantMonitoringSummaryBefore =
        await merchantMonitoringService.getMerchantMonitoringHistory(
          source,
          this.user.userId,
          this.getTimestampCondition(
            merchantMonitoringSummary[0].updatedAt ?? 0
          )
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

  private getTimestampCondition(
    updatedAt: number
  ): Filter<MerchantMonitoringSummary> {
    return {
      updatedAt: {
        $lt: Math.min(
          updatedAt ?? Number.MAX_SAFE_INTEGER,
          dayjs().subtract(1, 'day').valueOf()
        ),
      },
    }
  }
}
