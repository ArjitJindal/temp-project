import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Rule } from '../rule'
import { Vars } from '../utils/format-description'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Rule as RuleModel } from '@/@types/openapi-internal/Rule'
import { SanctionsService } from '@/services/sanctions'
import { IBANService } from '@/services/iban.com'

export interface UserVars<P> extends Vars {
  user: User | Business
  parameters: P
}
export abstract class UserRule<P, T extends object = object> extends Rule {
  tenantId: string
  user: User | Business
  parameters: P
  filters: T
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  ongoingScreeningMode: boolean
  ruleInstance: RuleInstance
  rule: RuleModel
  sanctionsService: SanctionsService
  ibanService: IBANService

  constructor(
    tenantId: string,
    data: {
      user: User | Business
      ongoingScreeningMode?: boolean
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
    mongoDb: MongoClient,
    dynamoDb: DynamoDBDocumentClient
  ) {
    super()
    this.tenantId = tenantId
    this.user = data.user
    this.ongoingScreeningMode = data.ongoingScreeningMode ?? false
    this.parameters = params.parameters
    this.filters = params.filters || {}
    this.ruleInstance = context.ruleInstance
    this.rule = context.rule
    this.sanctionsService = services.sanctionsService
    this.ibanService = services.ibanService
    this.mongoDb = mongoDb
    this.dynamoDb = dynamoDb
  }

  public getUserVars(): UserVars<P> {
    return {
      user: this.user,
      parameters: this.parameters,
    }
  }
}
