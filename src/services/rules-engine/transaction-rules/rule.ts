import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Rule } from '../rule'
import { Vars } from '../utils/format-description'
import { Business } from '@/@types/openapi-public/Business'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import { formatCountry } from '@/utils/countries'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

export type RuleResult = {
  action: RuleAction
}

export interface PartyVars {
  type?: 'origin' | 'destination'
  user?: User | Business
  title?: string | number | boolean
  amount?: {
    country?: string | number | boolean
    currency?: string | number | boolean
    amount?: string | number | boolean
  }
  payment?: {
    country?: string | number | boolean
  }
  ipAddress?: string | number | boolean
}

export interface TransactionVars<P> extends Vars {
  hitParty?: PartyVars
  origin?: PartyVars
  destination?: PartyVars
  transaction: Transaction
  senderUser?: User | Business
  receiverUser?: User | Business
  parameters: P
}

export class TransactionRule<P, T extends object = object> extends Rule {
  tenantId: string
  transaction: Transaction
  senderUser?: User | Business
  receiverUser?: User | Business
  parameters: P
  filters: T
  action: RuleAction
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    data: {
      transaction: Transaction
      senderUser?: User | Business
      receiverUser?: User | Business
    },
    params: {
      parameters: P
      filters: T
      action: RuleAction
    },
    dynamoDb: DynamoDBDocumentClient
  ) {
    super()
    this.tenantId = tenantId
    this.transaction = data.transaction
    this.senderUser = data.senderUser
    this.receiverUser = data.receiverUser
    this.parameters = params.parameters
    this.filters = params.filters || {}
    this.action = params.action
    this.dynamoDb = dynamoDb
  }

  private getTransactionDescriptionVars(
    hitDirection: 'origin' | 'destination' | null
  ): Partial<TransactionVars<unknown>> {
    const transaction = this.transaction

    const result: Partial<TransactionVars<unknown>> = {
      hitParty: undefined,
      origin: {
        type: 'origin',
        title: 'Sender',
        payment: {
          country: formatCountry(
            (transaction.originPaymentDetails as CardDetails)?.cardIssuedCountry
          ),
        },
        amount: {
          country: formatCountry(transaction.originAmountDetails?.country),
          currency: transaction.originAmountDetails?.transactionCurrency,
          amount: transaction.originAmountDetails?.transactionAmount,
        },
        ipAddress: transaction.deviceData?.ipAddress,
        user: this.senderUser,
      },
      destination: {
        type: 'destination',
        title: 'Receiver',
        payment: {
          country: formatCountry(
            (transaction.destinationPaymentDetails as CardDetails)
              ?.cardIssuedCountry
          ),
        },
        amount: {
          country: formatCountry(transaction.destinationAmountDetails?.country),
          currency: transaction.destinationAmountDetails?.transactionCurrency,
          amount: transaction.destinationAmountDetails?.transactionAmount,
        },
        ipAddress: transaction.deviceData?.ipAddress,
        user: this.receiverUser,
      },
    }
    if (hitDirection != null) {
      result.hitParty = result[hitDirection]
    }
    return result
  }

  public getTransactionVars(
    hitDirection: 'origin' | 'destination' | null
  ): TransactionVars<P> {
    // const parentVars = await super.getDescriptionVars()
    const transactionVars = this.getTransactionDescriptionVars(hitDirection)
    return {
      // ...parentVars,
      ...transactionVars,
      transaction: this.transaction,
      senderUser: this.senderUser,
      receiverUser: this.receiverUser,
      parameters: this.parameters,
    }
  }
}
