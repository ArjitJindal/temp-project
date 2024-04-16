import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { NotFound, BadRequest } from 'http-errors'
import { omit } from 'lodash'
import { MongoClient } from 'mongodb'
import { UserRepository } from '../users/repositories/user-repository'
import { RiskScoringService } from '../risk-scoring'
import { UserEventRepository } from './repositories/user-event-repository'
import { RulesEngineService } from '.'
import { logger } from '@/core/logger'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { BusinessEntityLink } from '@/@types/openapi-internal/BusinessEntityLink'
import { UserType } from '@/@types/user/user-type'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { mergeEntities, pickKnownEntityFields } from '@/utils/object'
import { BusinessBase } from '@/@types/openapi-public/BusinessBase'
import { UserBase } from '@/@types/openapi-internal/UserBase'
import { traceable } from '@/core/xray'
import { hasFeature } from '@/core/utils/context'
import { UserRiskScoreDetails } from '@/@types/openapi-internal/UserRiskScoreDetails'

@traceable
export class UserManagementService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  rulesEngineService: RulesEngineService
  userRepository: UserRepository
  userEventRepository: UserEventRepository
  riskScoringService: RiskScoringService

  constructor(
    tenantId: string,
    dynamoDb: DynamoDBDocumentClient,
    mongoDb: MongoClient
  ) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId

    this.userRepository = new UserRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })
    this.riskScoringService = new RiskScoringService(tenantId, {
      dynamoDb,
      mongoDb,
    })

    this.userEventRepository = new UserEventRepository(tenantId, { dynamoDb })
    this.rulesEngineService = new RulesEngineService(
      tenantId,
      dynamoDb,
      mongoDb
    )
    this.riskScoringService = new RiskScoringService(tenantId, {
      dynamoDb,
      mongoDb,
    })
  }

  public async verifyUser(
    userPayload: User | Business,
    type: UserType
  ): Promise<UserWithRulesResult | BusinessWithRulesResult> {
    const isConsumerUser = type === 'CONSUMER'

    if (!isConsumerUser && (userPayload as Business)?.linkedEntities) {
      try {
        if ((userPayload as Business).linkedEntities) {
          await this.validateLinkedEntitiesAndEmitEvent(
            (userPayload as Business).linkedEntities ?? {},
            userPayload.userId
          )
        }
      } catch (e: any) {
        logger.info(typeof e)
        throw new BadRequest(e.message)
      }
    }

    const userResult = {
      ...userPayload,
      ...(await this.rulesEngineService.verifyUser(userPayload)),
    }

    isConsumerUser
      ? await this.userRepository.saveConsumerUser(userResult)
      : await this.userRepository.saveBusinessUser(
          userResult as BusinessWithRulesResult
        )

    return userResult
  }

  public async validateLinkedEntitiesAndEmitEvent(
    linkedEntities: BusinessEntityLink,
    currentUserId: string
  ) {
    if (linkedEntities?.parentUserId) {
      const parentUserId = linkedEntities.parentUserId
      const parentUser = await this.userRepository.getBusinessUser(
        parentUserId as string
      )
      if (!parentUser) {
        throw new BadRequest(
          `Parent user ID : ${parentUserId} passed in linkedEntities does not exist. Please create the entitiy before linking it`
        )
      }
      let updateParentAttributes
      if (parentUser.linkedEntities) {
        updateParentAttributes = {
          linkedEntities: {
            ...parentUser.linkedEntities,
            childUserIds: Array.from(
              new Set(
                (parentUser.linkedEntities.childUserIds ?? []).concat(
                  currentUserId
                )
              )
            ),
          },
        }
      } else {
        updateParentAttributes = {
          linkedEntities: {
            childUserIds: [currentUserId],
          },
        }
      }

      const parentUserEvent: BusinessUserEvent = {
        timestamp: Date.now(),
        userId: parentUser.userId,
        reason: `Entity ${currentUserId} linked to it's parent ${parentUser.userId}`,
        updatedBusinessUserAttributes: updateParentAttributes,
      }

      await this.verifyBusinessUserEvent(parentUserEvent)
    }

    if (linkedEntities?.childUserIds) {
      const existingChildUsers = (
        await Promise.all(
          linkedEntities.childUserIds.map(async (childUserId: string) => {
            const childUser = await this.userRepository.getBusinessUser(
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
              const childUserEvent: BusinessUserEvent = {
                timestamp: Date.now(),
                userId: childUser.userId,
                reason: `Entity ${currentUserId} linked to it's child ${childUser.userId}`,
                updatedBusinessUserAttributes: updateChildAttributes,
              }

              await this.verifyBusinessUserEvent(childUserEvent)

              return childUser
            }
          })
        )
      ).filter((user: any) => user !== undefined)

      if (existingChildUsers.length < linkedEntities.childUserIds.length) {
        throw new BadRequest(
          `Child user IDs passed in linkedEntities does not exist. Please create the entitiy before linking it. Existing Children have been linked`
        )
      }
    }
  }

  public async verifyConsumerUserEvent(
    userEvent: ConsumerUserEvent,
    allowUserTypeConversion = false
  ): Promise<UserWithRulesResult> {
    let user = await this.userRepository.getConsumerUser(userEvent.userId)
    if (!user) {
      throw new NotFound(
        `User ${userEvent.userId} not found. Please create the user ${userEvent.userId}`
      )
    }
    if (user.type === 'BUSINESS') {
      if (!allowUserTypeConversion) {
        throw new BadRequest(
          `Converting a Business user to a Consumer user is not allowed.`
        )
      }
      user = pickKnownEntityFields(user, UserBase)
    }

    const { userId, updatedConsumerUserAttributes } = userEvent
    if (hasFeature('RISK_LEVELS')) {
      const preDefinedRiskLevel = updatedConsumerUserAttributes?.riskLevel

      if (preDefinedRiskLevel) {
        await this.riskScoringService.handleManualRiskLevel({
          ...updatedConsumerUserAttributes,
          userId,
        } as User | Business)
      }
    }

    const updatedConsumerUser: User = mergeEntities(
      user,
      updatedConsumerUserAttributes || {}
    ) as User

    let riskScoreDetails: UserRiskScoreDetails | undefined

    if (hasFeature('RISK_SCORING')) {
      riskScoreDetails =
        await this.riskScoringService?.calculateAndUpdateKRSAndDRS(
          updatedConsumerUser
        )
    }

    const updatedConsumerUserResult: UserWithRulesResult = {
      ...updatedConsumerUser,
      ...(await this.rulesEngineService.verifyUser(updatedConsumerUser)),
      riskScoreDetails,
    }
    await this.userEventRepository.saveUserEvent(userEvent, 'CONSUMER')
    await this.userRepository.saveConsumerUser(updatedConsumerUserResult)
    return omit(updatedConsumerUserResult, 'type')
  }

  public async verifyBusinessUserEvent(
    userEvent: BusinessUserEvent,
    allowUserTypeConversion = false
  ): Promise<BusinessWithRulesResult> {
    let user = await this.userRepository.getBusinessUser(userEvent.userId)
    if (!user) {
      throw new NotFound(
        `User ${userEvent.userId} not found. Please create the user ${userEvent.userId}`
      )
    }
    const updatedBusinessUserAttributes =
      userEvent.updatedBusinessUserAttributes || {}
    if (user.type === 'CONSUMER') {
      if (!allowUserTypeConversion) {
        throw new BadRequest(
          `Converting a Consumer user to a Business user is not allowed.`
        )
      }
      if (!updatedBusinessUserAttributes?.legalEntity) {
        throw new BadRequest(
          `Converting user ${user.userId} to a Business user. 'legalEntity' is a required field`
        )
      }
      user = pickKnownEntityFields(user, BusinessBase)
    }

    const { userId } = userEvent
    if (hasFeature('RISK_LEVELS')) {
      const preDefinedRiskLevel = updatedBusinessUserAttributes?.riskLevel

      if (preDefinedRiskLevel) {
        await this.riskScoringService.handleManualRiskLevel({
          ...updatedBusinessUserAttributes,
          userId,
        } as User | Business)
      }
    }

    const updatedBusinessUser: Business = mergeEntities(
      user,
      userEvent.updatedBusinessUserAttributes || {},
      false
    )

    let riskScoreDetails: UserRiskScoreDetails | undefined
    if (hasFeature('RISK_SCORING')) {
      riskScoreDetails =
        await this.riskScoringService.calculateAndUpdateKRSAndDRS(
          updatedBusinessUser
        )
    }

    const updatedBusinessUserResult = {
      ...updatedBusinessUser,
      ...(await this.rulesEngineService.verifyUser(updatedBusinessUser)),
      riskScoreDetails,
    }

    await this.userEventRepository.saveUserEvent(userEvent, 'BUSINESS')
    await this.userRepository.saveBusinessUser(updatedBusinessUserResult)
    return omit(updatedBusinessUserResult, 'type')
  }
}
