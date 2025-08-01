import { Document, MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Rule, UserOngoingHitResult } from '../rule'
import { Vars } from '../utils/format-description'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Rule as RuleModel } from '@/@types/openapi-internal/Rule'
import { SanctionsService } from '@/services/sanctions'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { hasFeature } from '@/core/utils/context'
import { getUsersFilterByRiskLevel } from '@/services/users/utils/user-utils'
import { UserRuleStage } from '@/@types/openapi-internal/UserRuleStage'

export interface UserVars<P> extends Vars {
  user: User | Business
  parameters: P
}

export interface UserOngoingVars<P> extends Vars {
  parameters: P
}

export abstract class UserOngoingRule<P> extends Rule {
  tenantId: string
  parameters: P
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  ruleInstance: RuleInstance
  rule: RuleModel
  stage: UserRuleStage
  riskLevelParameters: Record<RiskLevel, P>
  riskRepository: RiskRepository
  from?: string
  to?: string
  fromTimestamp?: number

  constructor(
    tenantId: string,
    params: { parameters: P; riskLevelParameters: Record<RiskLevel, P> },
    context: { ruleInstance: RuleInstance; rule: RuleModel },
    services: { riskRepository: RiskRepository },
    mongoDb: MongoClient,
    dynamoDb: DynamoDBDocumentClient,
    stage: UserRuleStage
  ) {
    super()
    this.tenantId = tenantId
    this.parameters = params.parameters
    this.ruleInstance = context.ruleInstance
    this.rule = context.rule
    this.stage = stage
    this.mongoDb = mongoDb
    this.dynamoDb = dynamoDb
    this.riskLevelParameters = params.riskLevelParameters
    this.riskRepository = services.riskRepository
  }

  public getUserOngoingVars(): UserOngoingVars<P> {
    return {
      parameters: this.parameters,
    }
  }

  public abstract getHitRulePipline(params: P): Document[]

  public async computeRule(): Promise<UserOngoingHitResult | undefined> {
    const usersCollectionName = USERS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const usersCollection = db.collection<InternalUser>(usersCollectionName)
    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()

    const hitUsersCursors =
      hasFeature('RISK_LEVELS') && this.riskLevelParameters
        ? Object.entries(this.riskLevelParameters).map(([key, params]) => {
            const pipeline = [
              {
                $match: getUsersFilterByRiskLevel(
                  [key as RiskLevel],
                  riskClassificationValues
                ),
              },
              {
                $sort: {
                  userId: 1,
                },
              },
              ...this.getHitRulePipline(params),
            ]

            return usersCollection.aggregate<InternalUser>(pipeline, {
              allowDiskUse: true,
            })
          })
        : [
            usersCollection.aggregate<InternalUser>(
              this.getHitRulePipline(this.parameters),
              { allowDiskUse: true }
            ),
          ]

    const hitResult: UserOngoingHitResult = {
      hitUsersCursors,
      direction: 'ORIGIN',
      vars: this.getUserOngoingVars(),
    }

    return hitResult
  }
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
  stage: UserRuleStage

  constructor(
    tenantId: string,
    data: {
      user: User | Business
      stage: UserRuleStage
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
    },
    mongoDb: MongoClient,
    dynamoDb: DynamoDBDocumentClient
  ) {
    super()
    this.tenantId = tenantId
    this.user = data.user
    this.stage = data.stage
    this.ongoingScreeningMode = data.stage === 'ONGOING'
    this.parameters = params.parameters
    this.filters = params.filters || {}
    this.ruleInstance = context.ruleInstance
    this.rule = context.rule
    this.sanctionsService = services.sanctionsService
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
