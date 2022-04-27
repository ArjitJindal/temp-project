import dayjs from 'dayjs'
import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { isIpAddressInList, isUserInList } from '../utils/user-rule-utils'
import { UserEventRepository } from '../repositories/user-event-repository'
import { UserRule } from './rule'
import { UserEvent } from '@/@types/openapi-public/UserEvent'

export type AccountAccessEventRuleParameters = {
  accessThreshold: number
  timeWindowInSeconds: number

  // Optional parameters
  ipAddressesToCheck?: string[]
  userIdsToCheck?: string[] // If empty, all users will be checked
}

export default class AccountAccessEventRule extends UserRule<AccountAccessEventRuleParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<AccountAccessEventRuleParameters> {
    return {
      type: 'object',
      properties: {
        accessThreshold: { type: 'integer' },
        timeWindowInSeconds: { type: 'integer' },
        ipAddressesToCheck: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
        userIdsToCheck: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
      },
      required: ['accessThreshold', 'timeWindowInSeconds'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    const { ipAddressesToCheck, userIdsToCheck } = this.parameters
    return [
      () => this.userEvent?.type === 'LOGGED_IN',
      () => isIpAddressInList(this.userEvent?.metaData, ipAddressesToCheck),
      () => isUserInList(this.user, userIdsToCheck),
    ]
  }

  public async computeRule() {
    const { accessThreshold, timeWindowInSeconds, ipAddressesToCheck } =
      this.parameters
    const userEventRepository = new UserEventRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const userEvent = this.userEvent as UserEvent
    const afterTimestamp = dayjs
      .unix(userEvent.timestamp)
      .subtract(timeWindowInSeconds, 'seconds')
      .unix()
    const accessEvents =
      await userEventRepository.getAfterTimestampTypeUserEvents(
        userEvent.userId,
        afterTimestamp,
        'LOGGED_IN'
      )

    const targetAccessEvents = accessEvents.filter((accessEvent) =>
      isIpAddressInList(accessEvent?.metaData, ipAddressesToCheck)
    )

    if (targetAccessEvents.length + 1 > accessThreshold) {
      return { action: this.action }
    }
  }
}
