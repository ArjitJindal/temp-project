import _ from 'lodash'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { getReceiverKeyId, getSenderKeyId } from '../utils'
import { TimeWindow } from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'
import dayjs, { duration } from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { hasFeature } from '@/core/utils/context'

// NOTE: Increment this version to invalidate the existing aggregation data of all the rules
const AGGREGATION_VERSION = '1'

const AGGREGATION_TIME_FORMAT = 'YYYYMMDDHH'

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

  public async updateAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ) {
    if (!this.shouldUseAggregation()) {
      return
    }

    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const shouldSkipUpdateAggregation =
      await aggregationRepository.isTransactionApplied(
        this.ruleInstance.id!,
        direction,
        this.getAggregationVersion(),
        this.transaction.transactionId
      )
    if (shouldSkipUpdateAggregation) {
      logger.info('Skip updating aggregations...')
      return
    }

    const targetAggregations = await this.getRuleAggregations<A>(
      direction,
      this.transaction.timestamp!,
      this.transaction.timestamp! + 1
    )
    if ((targetAggregations?.length || 0) > 1) {
      throw new Error('Should only get one target aggregation')
    }
    const userKeyId =
      direction === 'origin'
        ? getSenderKeyId(this.tenantId, this.transaction, true)
        : getReceiverKeyId(this.tenantId, this.transaction, true)
    if (!userKeyId) {
      return
    }

    const targetHour =
      targetAggregations?.[0].hour ||
      dayjs(this.transaction.timestamp).format(AGGREGATION_TIME_FORMAT)
    const updatedAggregation = await this.getUpdatedTargetAggregation(
      direction,
      targetAggregations?.[0],
      isTransactionFiltered
    )
    if (!updatedAggregation) {
      return
    }

    const ttl = this.getUpdatedTTLAttribute()
    await aggregationRepository.refreshUserRuleTimeAggregations(
      userKeyId,
      this.ruleInstance.id as string,
      { [targetHour]: { ...updatedAggregation, ttl } },
      this.getAggregationVersion()
    )
    await aggregationRepository.markTransactionApplied(
      this.ruleInstance.id!,
      direction,
      this.getAggregationVersion(),
      this.transaction.transactionId,
      ttl
    )
    logger.info('Updated aggregation')
  }

  protected async refreshRuleAggregations<A>(
    direction: 'origin' | 'destination',
    data: {
      [key1: string]: A
    }
  ) {
    if (!this.shouldUseAggregation()) {
      return
    }

    logger.info('Rebuilding aggregations...')
    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const userKeyId =
      direction === 'origin'
        ? getSenderKeyId(this.tenantId, this.transaction, true)
        : getReceiverKeyId(this.tenantId, this.transaction, true)
    if (!userKeyId) {
      return
    }
    const ttl = this.getUpdatedTTLAttribute()
    await aggregationRepository.refreshUserRuleTimeAggregations(
      userKeyId,
      this.ruleInstance.id as string,
      _.mapValues(data, (v) => ({ ...v, ttl })),
      this.getAggregationVersion()
    )
    logger.info('Rebuilt aggregations.')
  }

  protected async getRuleAggregations<A>(
    direction: 'origin' | 'destination',
    afterTimestamp: number,
    beforeTimestamp: number
  ) {
    if (!this.shouldUseAggregation()) {
      return
    }

    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const userKeyId =
      direction === 'origin'
        ? getSenderKeyId(this.tenantId, this.transaction, true)
        : getReceiverKeyId(this.tenantId, this.transaction, true)
    if (!userKeyId) {
      return
    }
    return aggregationRepository.getUserRuleTimeAggregations<A>(
      userKeyId,
      this.ruleInstance.id as string,
      afterTimestamp,
      beforeTimestamp,
      AGGREGATION_TIME_FORMAT,
      this.getAggregationVersion()
    )
  }

  private getAggregationVersion(): string {
    const ruleInstanceVersion = this.ruleInstance.updatedAt!
    return `${AGGREGATION_VERSION}_${this.getRuleAggregationVersion()}_${ruleInstanceVersion}`
  }

  private getUpdatedTTLAttribute(): number {
    const { units, granularity } = this.getMaxTimeWindow()
    return (
      Math.floor(Date.now() / 1000) +
      duration(units, granularity).asSeconds() +
      86400 // add 1 day buffer
    )
  }

  private shouldUseAggregation(): boolean {
    const { units, granularity } = this.getMaxTimeWindow()
    // When testing, we want to make sure aggregation is used if the feature flag is on.
    const isMoreThanOneDay =
      duration(units, granularity).asHours() > 24 || process.env.ENV === 'local'
    return hasFeature('RULES_ENGINE_RULE_BASED_AGGREGATION') && isMoreThanOneDay
  }
}
