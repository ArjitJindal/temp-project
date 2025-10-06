import { JSONSchemaType } from 'ajv'
import { Document } from 'mongodb'
import { UserOngoingRule } from '../user-rules/rule'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongo-table-names'
import dayjs from '@/utils/dayjs'

export interface UserInactivityRuleParameters {
  inactivityDays: number
  checkDirection: 'sending' | 'receiving' | 'all'
}

export default class UserInactivity extends UserOngoingRule<UserInactivityRuleParameters> {
  public static getSchema(): JSONSchemaType<UserInactivityRuleParameters> {
    return {
      type: 'object',
      properties: {
        inactivityDays: {
          type: 'integer',
          title: 'Inactivity period threshold (days)',
          description:
            'The number of days to consider a {{userAlias}} inactive',
        },
        checkDirection: {
          type: 'string',
          title: 'Transaction history scope options',
          description:
            "sending: only check the sender's past sending transactions; all: check the sender's past sending and receiving transactions",
          enum: ['sending', 'receiving', 'all'],
          nullable: true,
        },
      },
      required: ['inactivityDays'],
      additionalProperties: false,
    }
  }

  public getHitRulePipline(params: UserInactivityRuleParameters): Document[] {
    return [
      {
        $lookup: {
          from: TRANSACTIONS_COLLECTION(this.tenantId),
          let: { userId: '$userId' },
          as: 'lastTransactionTimestamp',
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    ...(params.checkDirection !== 'receiving'
                      ? [{ $eq: ['$originUserId', '$$userId'] }]
                      : []),
                    ...(params.checkDirection !== 'sending'
                      ? [{ $eq: ['$destinationUserId', '$$userId'] }]
                      : []),
                  ],
                },
              },
            },
            {
              $sort: {
                timestamp: -1,
              },
            },
            {
              $limit: 1,
            },
            {
              $project: {
                timestamp: 1,
              },
            },
          ],
        },
      },
      {
        $match: {
          'lastTransactionTimestamp.timestamp': {
            $lt: dayjs().subtract(params.inactivityDays, 'days').valueOf(),
          },
        },
      },
    ]
  }
}
