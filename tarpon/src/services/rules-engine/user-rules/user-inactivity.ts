import { JSONSchemaType } from 'ajv'
import { max } from 'lodash'
import { DynamoDbTransactionRepository } from '../repositories/dynamodb-transaction-repository'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import dayjs from '@/utils/dayjs'

export interface UserInactivityRuleParameters {
  inactivityDays: number
  checkDirection: 'sending' | 'all'
}

export default class UserInactivity extends UserRule<UserInactivityRuleParameters> {
  public static getSchema(): JSONSchemaType<UserInactivityRuleParameters> {
    return {
      type: 'object',
      properties: {
        inactivityDays: {
          type: 'integer',
          title: 'Inactivity period threshold (days)',
          description: 'The number of days to consider a user inactive',
        },
        checkDirection: {
          type: 'string',
          title: 'Transaction history scope options',
          description:
            "sending: only check the sender's past sending transactions; all: check the sender's past sending and receiving transactions",
          enum: ['sending', 'all'],
          nullable: true,
        },
      },
      required: ['inactivityDays'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const { inactivityDays, checkDirection } = this.parameters
    if (!this.user) {
      return
    }

    const transactionRepository = new DynamoDbTransactionRepository(
      this.tenantId,
      this.dynamoDb
    )

    const lastSendingTransaction = (
      await transactionRepository.getLastNUserSendingTransactions(
        this.user.userId,
        1,
        {},
        ['timestamp']
      )
    )[0]

    const lastReceivingTransaction =
      checkDirection !== 'sending'
        ? (
            await transactionRepository.getLastNUserReceivingTransactions(
              this.user.userId,
              1,
              {},
              ['timestamp']
            )
          )[0]
        : undefined

    const lastTransactionTimestamp = max([
      lastSendingTransaction?.timestamp,
      lastReceivingTransaction?.timestamp,
    ])

    if (!lastTransactionTimestamp) {
      return
    }

    const hitResult: RuleHitResult = []

    if (
      dayjs().diff(dayjs(lastTransactionTimestamp), 'day') >= inactivityDays
    ) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: this.getUserVars(),
      })
    }

    return hitResult
  }
}
