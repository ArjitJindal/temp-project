import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { NotFound, BadRequest } from 'http-errors'
import _ from 'lodash'
import { MongoClient } from 'mongodb'
import { UserRepository } from '../users/repositories/user-repository'
import { UserEventRepository } from '../rules-engine/repositories/user-event-repository'
import { RulesEngineService } from '../rules-engine'
import { logger } from '@/core/logger'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { BusinessEntityLink } from '@/@types/openapi-internal/BusinessEntityLink'
import { UserType } from '@/@types/user/user-type'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'

export class UserManagementService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  rulesEngineService: RulesEngineService
  userRepository: UserRepository
  userEventRepository: UserEventRepository

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
    this.userEventRepository = new UserEventRepository(tenantId, { dynamoDb })
    this.rulesEngineService = new RulesEngineService(
      tenantId,
      dynamoDb,
      mongoDb
    )
  }

  public async verifyUser(
    userPayload: User | Business,
    type: UserType
  ): Promise<User | Business> {
    const isConsumerUser = type === 'CONSUMER'

    if (!isConsumerUser && (userPayload as Business)?.linkedEntities) {
      try {
        await this.validateLinkedEntitiesAndEmitEvent(
          (userPayload as Business).linkedEntities!,
          userPayload.userId
        )
      } catch (e: any) {
        logger.info(typeof e)
        throw new BadRequest(e.message)
      }
    }

    const userResult = {
      ...userPayload,
      ...(await this.rulesEngineService.verifyUser(userPayload)),
    }

    const user = isConsumerUser
      ? await this.userRepository.saveConsumerUser(userResult)
      : await this.userRepository.saveBusinessUser(
          userResult as BusinessWithRulesResult
        )
    return user
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
    userEvent: ConsumerUserEvent
  ): Promise<UserWithRulesResult> {
    const user = await this.userRepository.getConsumerUser(userEvent.userId)
    if (!user) {
      throw new NotFound(
        `User ${userEvent.userId} not found. Please create the user ${userEvent.userId}`
      )
    }
    const updatedConsumerUser: User = _.merge(
      user,
      userEvent.updatedConsumerUserAttributes || {}
    )
    const updatedConsumerUserResult = {
      ...updatedConsumerUser,
      ...(await this.rulesEngineService.verifyUser(updatedConsumerUser)),
    }
    await this.userEventRepository.saveUserEvent(userEvent, 'CONSUMER')
    await this.userRepository.saveConsumerUser(updatedConsumerUserResult)
    return updatedConsumerUserResult
  }

  public async verifyBusinessUserEvent(
    userEvent: BusinessUserEvent
  ): Promise<BusinessWithRulesResult> {
    const user = await this.userRepository.getBusinessUser(userEvent.userId)
    if (!user) {
      throw new NotFound(
        `User ${userEvent.userId} not found. Please create the user ${userEvent.userId}`
      )
    }

    const updatedBusinessUser: Business = _.mergeWith(
      user,
      userEvent.updatedBusinessUserAttributes || {},
      function (obj, src) {
        if (!_.isNil(src)) {
          return src
        }
        return obj
      }
    )
    const updatedBusinessUserResult = {
      ...updatedBusinessUser,
      ...(await this.rulesEngineService.verifyUser(updatedBusinessUser)),
    }

    await this.userEventRepository.saveUserEvent(userEvent, 'BUSINESS')
    await this.userRepository.saveBusinessUser(updatedBusinessUserResult)
    return updatedBusinessUserResult
  }
}
