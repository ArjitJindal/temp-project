import mapValues from 'lodash/mapValues'
import { getReceiverKeyId, getSenderKeyId } from '../utils'
import { getTransactionStatsTimeGroupLabelV2 } from '../utils/transaction-rule-utils'
import { TransactionRule } from './rule'
import { TimeWindow } from '@/@types/rule/params'
import { duration } from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { envIs } from '@/utils/env'
import {
  canAggregate,
  getAggregationGranularity,
} from '@/services/logic-evaluator/engine/utils'

// NOTE: Increment this version to invalidate the existing aggregation data of all the rules
const AGGREGATION_VERSION = '2'

@traceable
export abstract class TransactionAggregationRule<
  P,
  T extends object = object,
  A = unknown
> extends TransactionRule<P, T> {
  protected abstract getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    aggregation: A | undefined,
    isTransactionFiltered: boolean
  ): Promise<A | null>

  protected abstract getMaxTimeWindow(): TimeWindow

  // The hard-coded rule aggregation version is used along with the dynamic version
  // (from getAggregationVersion()). We need to bump the version whenver we update the
  // rule aggregation implementation if it'll make the existing aggregated data invalid.
  protected abstract getRuleAggregationVersion(): number

  protected shouldUseRawData() {
    // Use raw data for sandbox environment if aggregation data is not ready as it's
    // important to return the correct result when customers are testing the rules.
    // Related to FR-2916
    return envIs('sandbox') || !this.shouldUseAggregation()
  }

  public async isRebuilt(
    direction: 'origin' | 'destination'
  ): Promise<boolean> {
    const userKeyId = this.getUserKeyId(direction)
    if (
      !this.shouldUseAggregation() ||
      !this.aggregationRepository ||
      !userKeyId
    ) {
      return false
    }

    const availableVersion = await this.getLatestAvailableAggregationVersion(
      userKeyId,
      this.ruleInstance.id as string
    )
    return availableVersion === this.getLatestAggregationVersion()
  }

  public abstract shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): boolean

  public abstract rebuildUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): Promise<void>

  public getUserKeyId(direction: 'origin' | 'destination') {
    return direction === 'origin'
      ? getSenderKeyId(this.tenantId, this.transaction, {
          disableDirection: true,
        })
      : getReceiverKeyId(this.tenantId, this.transaction, {
          disableDirection: true,
        })
  }

  public async updateAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ) {
    if (
      !this.shouldUseAggregation() ||
      !this.aggregationRepository ||
      !this.shouldUpdateUserAggregation(direction, isTransactionFiltered)
    ) {
      return
    }
    const version = this.getLatestAggregationVersion()
    const shouldSkipUpdateAggregation =
      await this.aggregationRepository.isTransactionApplied(
        this.ruleInstance.id ?? '',
        direction,
        version,
        this.transaction.transactionId
      )
    if (shouldSkipUpdateAggregation) {
      logger.debug('Skip updating aggregations.')
      return
    }

    const staticTimestamp = this.getStaticTimestamp()
    const timestamp = staticTimestamp ?? this.transaction.timestamp

    const targetAggregations = await this.getRuleAggregations<A>(
      direction,
      timestamp,
      timestamp + 1
    )

    if ((targetAggregations?.length || 0) > 1) {
      throw new Error('Should only get one target aggregation')
    }

    const userKeyId = this.getUserKeyId(direction)

    if (!userKeyId) {
      return
    }

    const targetHour =
      targetAggregations?.[0]?.hour ||
      getTransactionStatsTimeGroupLabelV2(
        timestamp,
        this.getAggregationGranularity()
      )

    const updatedAggregation = await this.getUpdatedTargetAggregation(
      direction,
      targetAggregations?.[0],
      isTransactionFiltered
    )

    if (!updatedAggregation) {
      return
    }

    const ttl = this.getUpdatedTTLAttribute()

    await this.aggregationRepository.rebuildUserRuleTimeAggregations(
      userKeyId,
      this.ruleInstance.id as string,
      { [targetHour]: { ...updatedAggregation, ttl } },
      version
    )

    await this.aggregationRepository.markTransactionApplied(
      this.ruleInstance.id ?? '',
      direction,
      version,
      this.transaction.transactionId,
      ttl
    )
  }

  protected async saveRebuiltRuleAggregations<A>(
    direction: 'origin' | 'destination',
    data: {
      [key1: string]: A
    }
  ) {
    const userKeyId = this.getUserKeyId(direction)
    if (
      !this.shouldUseAggregation() ||
      !this.aggregationRepository ||
      !userKeyId
    ) {
      return
    }

    logger.debug('Saving rebuilt aggregations...')
    const ttl = this.getUpdatedTTLAttribute()
    const version = this.getLatestAggregationVersion()
    await this.aggregationRepository.rebuildUserRuleTimeAggregations(
      userKeyId,
      this.ruleInstance.id as string,
      mapValues(data, (v) => ({ ...v, ttl })),
      version
    )
    await this.aggregationRepository.updateAvailableUserRuleTimeAggregationVersion(
      userKeyId,
      this.ruleInstance.id as string,
      version
    )
    logger.debug('Saved rebuilt aggregations')
  }

  public async getRuleAggregations<A>(
    direction: 'origin' | 'destination',
    afterTimestamp: number,
    beforeTimestamp: number
  ) {
    const userKeyId = this.getUserKeyId(direction)
    if (
      !this.shouldUseAggregation() ||
      !this.aggregationRepository ||
      !userKeyId
    ) {
      return
    }

    // Use the latest version for sandbox environment instead of using the latest available version,
    // as it's important to return the correct result when customers are testing the rules.
    // TODO: FR-2916
    const version = envIs('sandbox')
      ? this.getLatestAggregationVersion()
      : await this.getLatestAvailableAggregationVersion(
          userKeyId,
          this.ruleInstance.id as string
        )
    if (!version) {
      return
    }

    return this.aggregationRepository.getUserLogicTimeAggregations<A>(
      userKeyId,
      this.ruleInstance.id as string,
      getTransactionStatsTimeGroupLabelV2(
        afterTimestamp,
        this.getAggregationGranularity()
      ),
      getTransactionStatsTimeGroupLabelV2(
        beforeTimestamp - 1,
        this.getAggregationGranularity()
      ),
      version
    )
  }

  protected getFilterAggregationData<T>(
    aggData: Array<T & { hour: string }>,
    afterTimestamp: number,
    beforeTimestamp: number
  ) {
    const afterHour = getTransactionStatsTimeGroupLabelV2(
      afterTimestamp,
      this.getAggregationGranularity()
    )
    const beforeHour = getTransactionStatsTimeGroupLabelV2(
      beforeTimestamp - 1,
      this.getAggregationGranularity()
    )
    const filterAggData = aggData.filter(
      (data) => data.hour >= afterHour && data.hour <= beforeHour
    )
    return filterAggData
  }

  private getLatestAggregationVersion(): string {
    const ruleInstanceVersion = this.ruleInstance.updatedAt ?? 0
    return `${AGGREGATION_VERSION}_${this.getRuleAggregationVersion()}_${ruleInstanceVersion}`
  }

  getLatestAvailableAggregationVersion = async (
    userKeyId: string,
    ruleInstanceId: string
  ): Promise<string | undefined> => {
    return this.aggregationRepository?.getLatestAvailableUserRuleTimeAggregationVersion(
      userKeyId,
      ruleInstanceId
    )
  }

  private getUpdatedTTLAttribute(): number {
    const units = this.getMaxTimeWindow().units
    let granularity = this.getMaxTimeWindow().granularity

    if (granularity === 'fiscal_year') {
      granularity = 'year'
    }

    return (
      Math.floor(Date.now() / 1000) +
      duration(units, granularity).asSeconds() +
      // Add 2 months to the TTL to make sure the data is still available when
      // the transaction events of a transaction are processed (assuming that the life
      // cycle of a single transaction shouldn't span across 2 months).
      duration(2, 'month').asSeconds()
    )
  }

  public shouldUseAggregation(): boolean {
    if (
      process.env.__INTERNAL_DISABLE_RULE_AGGREGATION__ ||
      !this.aggregationRepository
    ) {
      return false
    }
    const units = this.getMaxTimeWindow().units
    let granularity = this.getMaxTimeWindow().granularity

    if (granularity === 'fiscal_year') {
      granularity = 'year'
    }
    return (
      canAggregate({
        start: { units, granularity },
        end: { units: 1, granularity: 'now' },
      }) ||
      // When testing, we want to make sure aggregation is used if the feature flag is on.
      process.env.ENV === 'local'
    )
  }

  public getAggregationGranularity() {
    const start = this.getMaxTimeWindow()
    return getAggregationGranularity(
      {
        start,
        end: { units: 1, granularity: 'now' },
      },
      this.tenantId
    )
  }

  protected getStaticTimestamp(): number | undefined {
    return undefined
  }
}
