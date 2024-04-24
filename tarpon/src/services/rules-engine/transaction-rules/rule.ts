import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { Rule, RuleHitResultItem } from '../rule'
import { Vars } from '../utils/format-description'
import { RulesEngineTransactionRepositoryInterface } from '../repositories/transaction-repository-interface'
import { DynamoDbTransactionRepository } from '../repositories/dynamodb-transaction-repository'
import { MongoDbTransactionRepository } from '../repositories/mongodb-transaction-repository'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { Business } from '@/@types/openapi-public/Business'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import { formatCountry } from '@/utils/countries'
import { CardDetails } from '@/@types/openapi-public/CardDetails'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Rule as RuleModel } from '@/@types/openapi-internal/Rule'
import { traceable } from '@/core/xray'
import { SanctionsService } from '@/services/sanctions'
import { IBANService } from '@/services/iban'

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

@traceable
export abstract class TransactionRule<
  P,
  T extends object = object
> extends Rule {
  tenantId: string
  transaction: Transaction
  senderUser?: User | Business
  receiverUser?: User | Business
  parameters: P
  filters: T
  ruleInstance: RuleInstance
  rule: RuleModel
  dynamoDb: DynamoDBDocumentClient
  mongoDb?: MongoClient
  transactionRepository: RulesEngineTransactionRepositoryInterface
  aggregationRepository?: AggregationRepository
  sanctionsService: SanctionsService
  ibanService: IBANService
  mode: 'DYNAMODB' | 'MONGODB'
  transactionRiskScore?: number

  constructor(
    tenantId: string,
    data: {
      transaction: Transaction
      senderUser?: User | Business
      receiverUser?: User | Business
      transactionRiskScore?: number
    },
    params: {
      parameters: P
      filters: T
    },
    context: {
      ruleInstance: RuleInstance
      rule: RuleModel
    },
    services: {
      sanctionsService: SanctionsService
      ibanService: IBANService
    },
    mode: 'DYNAMODB' | 'MONGODB',
    dynamoDb: DynamoDBDocumentClient,
    mongoDb?: MongoClient
  ) {
    super()
    this.tenantId = tenantId
    this.transaction = data.transaction
    this.senderUser = data.senderUser
    this.receiverUser = data.receiverUser
    this.parameters = params.parameters
    this.filters = params.filters || {}
    this.ruleInstance = context.ruleInstance
    this.rule = context.rule
    this.sanctionsService = services.sanctionsService
    this.ibanService = services.ibanService
    this.dynamoDb = dynamoDb
    this.mongoDb = mongoDb
    this.mode = mode
    this.transactionRiskScore = data.transactionRiskScore

    if (mode === 'DYNAMODB' && dynamoDb) {
      this.transactionRepository = new DynamoDbTransactionRepository(
        tenantId,
        dynamoDb
      )
      this.aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    } else if (mode === 'MONGODB' && mongoDb) {
      this.transactionRepository = new MongoDbTransactionRepository(
        tenantId,
        mongoDb
      )
    } else {
      throw new Error('dynamodb / mongodb is not configured correctlly')
    }
  }

  // TODO: change this to abstract to make it required to implement
  protected computeRuleUser(
    _direction: 'origin' | 'destination'
  ): Promise<RuleHitResultItem | undefined> {
    return Promise.resolve(undefined)
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
        ipAddress: transaction.originDeviceData?.ipAddress,
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
        ipAddress: transaction.destinationDeviceData?.ipAddress,
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
