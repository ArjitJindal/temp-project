import _ from 'lodash'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { getReceiverKeyId, getSenderKeyId } from '../utils'
import { TimeWindow } from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'
import dayjs, { duration } from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { hasFeature } from '@/core/utils/context'

const AGGREGATION_TIME_FORMAT = 'YYYYMMDDHH'

export class TransactionAggregationRule<
  P,
  T extends object = object,
  A = unknown
> extends TransactionRule<P, T> {
  private aggregationVersion: number | undefined = undefined

  protected async getUpdatedTargetAggregation(
    _direction: 'origin' | 'destination',
    _aggregation: A | undefined
  ): Promise<A> {
    throw new Error('Not implemented')
  }

  protected getMaxTimeWindow(): TimeWindow {
    throw new Error('Not implemented')
  }

  public async updateAggregation(direction: 'origin' | 'destination') {
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
        ? getSenderKeyId(this.tenantId, this.transaction)
        : getReceiverKeyId(this.tenantId, this.transaction)
    if (!userKeyId) {
      return
    }

    const targetHour =
      targetAggregations?.[0].hour ||
      dayjs(this.transaction.timestamp).format(AGGREGATION_TIME_FORMAT)
    const updatedAggregation = await this.getUpdatedTargetAggregation(
      direction,
      targetAggregations?.[0]
    )
    const ttl = this.getUpdatedTTLAttribute()
    await aggregationRepository.refreshUserRuleTimeAggregations(
      userKeyId,
      this.ruleInstance.id as string,
      direction,
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
        ? getSenderKeyId(this.tenantId, this.transaction)
        : getReceiverKeyId(this.tenantId, this.transaction)
    if (!userKeyId) {
      return
    }
    const ttl = this.getUpdatedTTLAttribute()
    await aggregationRepository.refreshUserRuleTimeAggregations(
      userKeyId,
      this.ruleInstance.id as string,
      direction,
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
        ? getSenderKeyId(this.tenantId, this.transaction)
        : getReceiverKeyId(this.tenantId, this.transaction)
    if (!userKeyId) {
      return
    }
    return aggregationRepository.getUserRuleTimeAggregations<A>(
      userKeyId,
      this.ruleInstance.id as string,
      direction,
      afterTimestamp,
      beforeTimestamp,
      AGGREGATION_TIME_FORMAT,
      this.getAggregationVersion()
    )
  }

  private getAggregationVersion(): string {
    if (!this.aggregationVersion) {
      this.aggregationVersion = this.ruleInstance.updatedAt!
    }
    return `${this.aggregationVersion}`
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
