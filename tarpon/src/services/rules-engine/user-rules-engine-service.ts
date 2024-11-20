import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { NotFound, BadRequest } from 'http-errors'
import { isEmpty, omit } from 'lodash'
import { MongoClient } from 'mongodb'
import { UserRepository } from '../users/repositories/user-repository'
import { RiskScoringService } from '../risk-scoring'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { UserEventRepository } from './repositories/user-event-repository'
import { isBusinessUser } from './utils/user-rule-utils'
import { mergeRules } from './utils/rule-utils'
import { getUserRiskScoreDetailsForPNB } from './pnb-custom-logic'
import { mergeUserTags, sendAsyncRuleTasks } from './utils'
import { RulesEngineService } from '.'
import { logger } from '@/core/logger'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { UserType } from '@/@types/user/user-type'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { mergeEntities, pickKnownEntityFields } from '@/utils/object'
import { BusinessBase } from '@/@types/openapi-public/BusinessBase'
import { UserBase } from '@/@types/openapi-internal/UserBase'
import { traceable } from '@/core/xray'
import { hasFeature } from '@/core/utils/context'
import { UserRiskScoreDetails } from '@/@types/openapi-internal/UserRiskScoreDetails'
import { UserEntityLink } from '@/@types/openapi-public/UserEntityLink'
import { CaseRepository } from '@/services/cases/repository'
import { UserTag } from '@/@types/openapi-internal/UserTag'

type ConsumerUser = User & { type: 'CONSUMER' }
type BusinessUser = Business & { type: 'BUSINESS' }

type UserEventType<T extends UserType> = T extends 'CONSUMER'
  ? ConsumerUserEvent
  : BusinessUserEvent

type UpdatedAttributesType<T extends UserType> = T extends 'CONSUMER'
  ? ConsumerUserEvent['updatedConsumerUserAttributes']
  : BusinessUserEvent['updatedBusinessUserAttributes']

type UserResultType<T extends UserType> = T extends 'CONSUMER'
  ? UserWithRulesResult
  : BusinessWithRulesResult

@traceable
export class UserManagementService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  rulesEngineService: RulesEngineService
  userRepository: UserRepository
  userEventRepository: UserEventRepository
  riskScoringService: RiskScoringService
  riskScoringV8Service: RiskScoringV8Service
  caseRepository: CaseRepository

  constructor(
    tenantId: string,
    dynamoDb: DynamoDBDocumentClient,
    mongoDb: MongoClient,
    logicEvaluator: LogicEvaluator
  ) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId

    this.userRepository = new UserRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })
    this.userEventRepository = new UserEventRepository(tenantId, { dynamoDb })
    this.rulesEngineService = new RulesEngineService(
      tenantId,
      dynamoDb,
      logicEvaluator,
      mongoDb
    )
    this.riskScoringService = new RiskScoringService(tenantId, {
      dynamoDb,
      mongoDb,
    })
    this.riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        dynamoDb,
        mongoDb,
      }
    )
    this.caseRepository = new CaseRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })
  }

  public async verifyUser(
    userPayload: User | Business,
    type: UserType
  ): Promise<UserWithRulesResult | BusinessWithRulesResult> {
    const isConsumerUser = type === 'CONSUMER'

    if (userPayload.linkedEntities) {
      try {
        if (userPayload.linkedEntities) {
          await this.validateLinkedEntitiesAndEmitEvent(
            userPayload.linkedEntities ?? {},
            userPayload.userId
          )
        }
      } catch (e: any) {
        logger.info(typeof e)
        throw new BadRequest(e.message)
      }
    }

    const { monitoringResult, isAnyAsyncRules } =
      await this.rulesEngineService.verifyUser(userPayload)

    const userResult = {
      ...userPayload,
      ...monitoringResult,
    }

    const asyncRulesPromises = isAnyAsyncRules
      ? [
          sendAsyncRuleTasks([
            {
              type: 'USER',
              user: userPayload,
              tenantId: this.tenantId,
              userType: type,
            },
          ]),
        ]
      : []

    if (isConsumerUser) {
      await Promise.all([
        this.userRepository.saveConsumerUser(userResult),
        this.userEventRepository.saveUserEvent(
          {
            timestamp: userResult.createdTimestamp,
            userId: userResult.userId,
            updatedConsumerUserAttributes: userResult,
          },
          'CONSUMER',
          monitoringResult
        ),
        ...asyncRulesPromises,
      ])
    } else {
      await Promise.all([
        this.userRepository.saveBusinessUser(
          userResult as BusinessWithRulesResult
        ),
        this.userEventRepository.saveUserEvent(
          {
            timestamp: userResult.createdTimestamp,
            userId: userResult.userId,
            updatedBusinessUserAttributes: userResult as Business,
          },
          'BUSINESS',
          monitoringResult
        ),
        ...asyncRulesPromises,
      ])
    }

    return userResult
  }

  public async validateLinkedEntitiesAndEmitEvent(
    linkedEntities: UserEntityLink,
    currentUserId: string
  ) {
    if (linkedEntities?.parentUserId) {
      const parentUserId = linkedEntities.parentUserId
      const parentUser = await this.userRepository.getUser<User | Business>(
        parentUserId
      )
      if (!parentUser) {
        throw new BadRequest(
          `Parent user ID : ${parentUserId} passed in linkedEntities does not exist. Please create the entitiy before linking it`
        )
      }
    }

    // !!DEPRECATED!!: We have removed childUserIds from linkedEntities. The logic below will only be used by
    // capimoney before they migrate away from childUserIds
    // TODO: Remove this logic once capimoney migrates away from childUserIds
    const childUserIds: string[] = (linkedEntities as any)?.childUserIds ?? []
    if (this.tenantId === 'QYF2BOXRJI' && !isEmpty(childUserIds)) {
      await Promise.all(
        childUserIds.map(async (childUserId: string) => {
          const childUser = await this.userRepository.getUser<User | Business>(
            childUserId
          )
          if (childUser) {
            let updateChildAttributes
            if (childUser.linkedEntities) {
              updateChildAttributes = {
                linkedEntities: {
                  ...childUser.linkedEntities,
                  parentUserId: currentUserId,
                },
              }
            } else {
              updateChildAttributes = {
                linkedEntities: {
                  parentUserId: currentUserId,
                },
              }
            }
            const childUserEvent = {
              timestamp: Date.now(),
              userId: childUser.userId,
              reason: `Entity ${currentUserId} linked to it's child ${childUser.userId}`,
            }
            if (isBusinessUser(childUser)) {
              await this.verifyBusinessUserEvent({
                ...childUserEvent,
                updatedBusinessUserAttributes: updateChildAttributes,
              })
            } else {
              await this.verifyConsumerUserEvent({
                ...childUserEvent,
                updatedConsumerUserAttributes: updateChildAttributes,
              })
            }
            return childUser
          }
        })
      )
    }
  }

  private getUpdatedUserAttributes<T extends UserType>(
    type: T,
    userEvent: UserEventType<T>
  ): UpdatedAttributesType<T> {
    return type === 'CONSUMER'
      ? (userEvent as ConsumerUserEvent).updatedConsumerUserAttributes
      : (userEvent as BusinessUserEvent).updatedBusinessUserAttributes
  }

  private async verifyUserEvent<T extends UserType>(
    userType: T,
    userEvent: UserEventType<T>,
    allowUserTypeConversion: boolean,
    getUser: (
      userId: string
    ) => Promise<(UserResultType<T> & { type: UserType }) | undefined>,
    saveUser: (user: UserResultType<T>) => Promise<UserResultType<T>>,
    isDrsUpdatable?: boolean
  ): Promise<UserResultType<T>> {
    let user = await getUser(userEvent.userId)
    if (!user) {
      throw new NotFound(
        `User ${userEvent.userId} not found. Please create the user ${userEvent.userId}`
      )
    }

    const oppositeType: UserType =
      userType === 'CONSUMER' ? 'BUSINESS' : 'CONSUMER'
    if (user.type === oppositeType) {
      if (!allowUserTypeConversion) {
        throw new BadRequest(
          `Converting a ${oppositeType} user to a ${userType} user is not allowed.`
        )
      }

      if (
        userType === 'BUSINESS' &&
        !(userEvent as BusinessUserEvent).updatedBusinessUserAttributes
          ?.legalEntity
      ) {
        throw new BadRequest(
          `Converting user ${user.userId} to a Business user. 'legalEntity' is a required field`
        )
      }

      user = pickKnownEntityFields(
        user,
        userType === 'CONSUMER' ? UserBase : BusinessBase
      )
    }

    const updatedAttributes: UpdatedAttributesType<T> =
      this.getUpdatedUserAttributes(userType, userEvent) ?? {}

    if (hasFeature('RISK_LEVELS') && !hasFeature('RISK_SCORING_V8')) {
      const preDefinedRiskLevel = updatedAttributes?.riskLevel

      if (preDefinedRiskLevel) {
        await this.riskScoringService.handleManualRiskLevel(
          {
            ...updatedAttributes,
            userId: user.userId,
          } as User | Business,
          isDrsUpdatable
        )
      }
    }
    let updatedTags: UserTag[] | undefined
    if (updatedAttributes.tags) {
      updatedTags = mergeUserTags(user.tags ?? [], updatedAttributes.tags)
    }

    const updatedUser = {
      ...(mergeEntities(user, updatedAttributes, userType === 'CONSUMER') as
        | ConsumerUser
        | BusinessUser),
      ...(updatedTags ? { tags: updatedTags } : {}),
    }

    let riskScoreDetails: UserRiskScoreDetails | undefined

    if (hasFeature('RISK_SCORING')) {
      if (hasFeature('RISK_SCORING_V8')) {
        riskScoreDetails = await this.riskScoringV8Service.handleUserUpdate(
          updatedUser,
          updatedAttributes.riskLevel,
          isDrsUpdatable
        )
      } else {
        riskScoreDetails =
          await this.riskScoringService.calculateAndUpdateKRSAndDRS(
            updatedUser,
            isDrsUpdatable
          )
      }
    }

    const { monitoringResult, isAnyAsyncRules } =
      await this.rulesEngineService.verifyUser(updatedUser)

    const updatedUserResult = {
      ...updatedUser,
      riskLevel: riskScoreDetails?.craRiskLevel,
      ...monitoringResult,
      riskScoreDetails,
    }

    await Promise.all([
      saveUser(updatedUserResult as UserResultType<T>),
      this.userEventRepository.saveUserEvent(
        userEvent,
        userType,
        monitoringResult
      ),
      isAnyAsyncRules &&
        sendAsyncRuleTasks([
          {
            type: 'USER_EVENT',
            tenantId: this.tenantId,
            updatedUser: omit<User | Business>(updatedUserResult, [
              'executedRules',
              'hitRules',
            ]) as User | Business,
            userType,
            userEventTimestamp: userEvent.timestamp,
          },
        ]),
    ])

    return {
      ...(omit(updatedUserResult, 'type') as UserResultType<T>),
      hitRules: monitoringResult.hitRules,
      executedRules: monitoringResult.executedRules,
      riskScoreDetails: hasFeature('PNB')
        ? getUserRiskScoreDetailsForPNB(
            monitoringResult.hitRules ?? [],
            riskScoreDetails ?? {}
          )
        : riskScoreDetails,
    }
  }

  public async verifyBusinessUserEvent(
    userEvent: BusinessUserEvent,
    allowUserTypeConversion = false,
    isDrsUpdatable?: boolean
  ): Promise<BusinessWithRulesResult> {
    return this.verifyUserEvent<'BUSINESS'>(
      'BUSINESS',
      userEvent,
      allowUserTypeConversion,
      this.userRepository.getBusinessUser.bind(this.userRepository),
      this.userRepository.saveBusinessUser.bind(this.userRepository),
      isDrsUpdatable
    ) as Promise<BusinessWithRulesResult>
  }

  public async verifyConsumerUserEvent(
    userEvent: ConsumerUserEvent,
    allowUserTypeConversion = false,
    isDrsUpdatable?: boolean
  ): Promise<UserWithRulesResult> {
    return this.verifyUserEvent<'CONSUMER'>(
      'CONSUMER',
      userEvent,
      allowUserTypeConversion,
      this.userRepository.getConsumerUser.bind(this.userRepository),
      this.userRepository.saveConsumerUser.bind(this.userRepository),
      isDrsUpdatable
    )
  }

  public async verifyAsyncRulesUser(
    type: UserType,
    userPayload: User | Business
  ): Promise<void> {
    const userId = userPayload.userId

    const user = await this.userRepository.getUser<
      UserWithRulesResult | BusinessWithRulesResult
    >(userId)

    if (!user) {
      throw new NotFound(`User ${userId} not found`)
    }

    const { monitoringResult } = await this.rulesEngineService.verifyUser(
      userPayload,
      { async: true }
    )

    const mergedExecutedRules = mergeRules(
      user.executedRules ?? [],
      monitoringResult.executedRules ?? []
    )

    const mergedHitRules = mergeRules(
      user.hitRules ?? [],
      monitoringResult.hitRules ?? []
    )
    await Promise.all([
      this.userRepository.updateUserWithExecutedRules(
        userId,
        mergedExecutedRules,
        mergedHitRules
      ),
      this.userEventRepository.updateUserEventWithRulesResult(
        userId,
        type,
        user.createdTimestamp,
        monitoringResult
      ),
    ])
  }

  public async verifyAsyncRulesUserEvent(
    userType: UserType,
    updatedUser: User | Business,
    userEventTimestamp: number
  ): Promise<void> {
    const userId = updatedUser.userId

    const userEvent = await this.userEventRepository.getUserEvent(
      userType,
      userId,
      userEventTimestamp
    )

    if (!userEvent) {
      throw new NotFound(`User Event ${userId} not found`)
    }

    const { monitoringResult } = await this.rulesEngineService.verifyUser(
      updatedUser,
      { async: true }
    )

    const mergedExecutedRules = mergeRules(
      userEvent.executedRules ?? [],
      monitoringResult.executedRules ?? []
    )

    const mergedHitRules = mergeRules(
      userEvent.hitRules ?? [],
      monitoringResult.hitRules ?? []
    )

    await Promise.all([
      this.userEventRepository.updateUserEventWithRulesResult(
        userId,
        userType,
        userEventTimestamp,
        monitoringResult
      ),
      this.userRepository.updateUserWithExecutedRules(
        userId,
        mergedExecutedRules,
        mergedHitRules
      ),
    ])
  }
}
