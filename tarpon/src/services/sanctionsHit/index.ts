import { S3 } from '@aws-sdk/client-s3'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import pluralize from 'pluralize'
import { AlertsService } from '../alerts'
import { CaseService } from '../cases'
import { UserService } from '../users'
import { CaseRepository } from '../cases/repository'
import { UserRepository } from '../users/repositories/user-repository'
import { AlertsRepository } from '../alerts/repository'
import { SanctionsHitsRepository } from '../sanctions/repositories/sanctions-hits-repository'
import {
  SanctionsWhitelistEntityRepository,
  WhitelistSubject,
} from '../sanctions/repositories/sanctions-whitelist-entity-repository'
import { S3Config } from '@/services/aws/s3-service'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getS3ClientByEvent } from '@/utils/s3'
import { CaseConfig } from '@/lambdas/console-api-case/app'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { SanctionHitStatusUpdateRequest } from '@/@types/openapi-internal/SanctionHitStatusUpdateRequest'
import { CursorPaginationParams, iterateCursorItems } from '@/utils/pagination'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsHitStatus } from '@/@types/openapi-internal/SanctionsHitStatus'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { SanctionsHitListResponse } from '@/@types/openapi-internal/SanctionsHitListResponse'
import { traceable } from '@/core/xray'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'

@traceable
export class SanctionsHitService {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  sanctionsHitsRepository: SanctionsHitsRepository
  sanctionsWhitelistEntityRepository: SanctionsWhitelistEntityRepository
  caseService: CaseService
  userService: UserService
  alertsService: AlertsService

  constructor(
    tenantId: string,
    connection: {
      mongoDb: MongoClient
      dynamoDb: DynamoDBDocumentClient
    },
    s3: S3,
    s3Config: S3Config,
    awsCredentials?: LambdaCredentials
  ) {
    this.tenantId = tenantId
    this.mongoDb = connection.mongoDb
    this.dynamoDb = connection.dynamoDb
    this.sanctionsHitsRepository = new SanctionsHitsRepository(
      tenantId,
      this.mongoDb
    )
    this.sanctionsWhitelistEntityRepository =
      new SanctionsWhitelistEntityRepository(tenantId, this.mongoDb)
    const caseRepository = new CaseRepository(tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    this.caseService = new CaseService(
      caseRepository,
      s3,
      s3Config,
      awsCredentials
    )

    const userRepository = new UserRepository(tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    this.userService = new UserService(
      tenantId,
      userRepository,
      s3,
      s3Config.tmpBucketName,
      s3Config.documentBucketName,
      awsCredentials
    )

    const alertsRepository = new AlertsRepository(tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    this.alertsService = new AlertsService(
      alertsRepository,
      s3,
      s3Config,
      awsCredentials
    )
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const s3 = getS3ClientByEvent(event)
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig

    const s3Config = {
      documentBucketName: DOCUMENT_BUCKET,
      tmpBucketName: TMP_BUCKET,
    }
    const awsCredentials = getCredentialsFromEvent(event)
    const sanctionHitService = new SanctionsHitService(
      tenantId,
      {
        mongoDb,
        dynamoDb,
      },
      s3,
      s3Config,
      awsCredentials
    )
    return sanctionHitService
  }

  public async updateHits(
    sanctionsHitIds: string[],
    updates: SanctionHitStatusUpdateRequest
  ): Promise<{ modifiedCount: number }> {
    const { modifiedCount } =
      await this.sanctionsHitsRepository.updateHitsByIds(sanctionsHitIds, {
        status: updates.status,
        clearingReason: updates.reasons,
        comment: updates.comment,
      })
    // todo: add audit log record
    return { modifiedCount }
  }

  public async changeSanctionsHitsStatus(
    alertId: string,
    sanctionHitIds: string[],
    updates: SanctionHitStatusUpdateRequest
  ): Promise<{ modifiedCount: number }> {
    const result = await this.updateHits(sanctionHitIds, updates)
    const whitelistUpdateComment = await this.handleWhitelistUpdates(
      alertId,
      sanctionHitIds,
      updates
    )
    await this.addComments(
      alertId,
      sanctionHitIds,
      updates,
      whitelistUpdateComment
    )
    return result
  }

  public async getSanctionsHit(
    sanctionsHitId: string
  ): Promise<SanctionsHit | null> {
    return await this.sanctionsHitsRepository.getHitById(sanctionsHitId)
  }

  public async deleteWhitelistRecordsByHits(
    sanctionsHitIds: string[]
  ): Promise<void> {
    const hitsIterator = iterateCursorItems(async ({ from }) =>
      this.sanctionsHitsRepository.searchHits({
        fromCursorKey: from,
        filterHitIds: sanctionsHitIds,
      })
    )
    const ids: string[] = []
    for await (const hit of hitsIterator) {
      const whitelistEntriesIterator = iterateCursorItems(async ({ from }) =>
        this.sanctionsWhitelistEntityRepository.searchWhitelistEntities({
          fromCursorKey: from,
          filterUserId: hit.hitContext?.userId
            ? [hit.hitContext?.userId]
            : undefined,
          filterEntity: hit.hitContext?.entity
            ? [hit.hitContext?.entity]
            : undefined,
          filterEntityType: hit.hitContext?.entityType
            ? [hit.hitContext?.entityType]
            : undefined,
        })
      )
      for await (const entry of whitelistEntriesIterator) {
        ids.push(entry.sanctionsWhitelistId)
      }
    }
    await this.sanctionsWhitelistEntityRepository.removeWhitelistEntities(ids)
  }

  private async handleWhitelistUpdates(
    alertId: string,
    sanctionHitIds: string[],
    updates: SanctionHitStatusUpdateRequest
  ): Promise<string | null> {
    const { whitelistHits, removeHitsFromWhitelist } = updates
    let whitelistUpdateComment: string | null = null

    if (updates.status === 'OPEN' && removeHitsFromWhitelist) {
      await this.deleteWhitelistRecordsByHits(sanctionHitIds)
    }

    if (updates.status === 'CLEARED' && whitelistHits) {
      for await (const hit of this.sanctionsHitsRepository.iterateHits({
        filterHitIds: sanctionHitIds,
      })) {
        if (hit.hitContext && hit.hitContext.userId != null && hit.entity) {
          const { newRecords } = await this.addWhitelistEntities(
            hit.provider,
            [hit.entity],
            {
              userId: hit.hitContext.userId,
              entity: hit.hitContext.entity,
              entityType: hit.hitContext.entityType,
              searchTerm: hit.hitContext.searchTerm,
              paymentMethodId: hit.hitContext.paymentMethodId,
              alertId: alertId,
            },
            {
              reason: updates.reasons,
              comment: updates.comment,
            }
          )

          if (newRecords.length > 0) {
            whitelistUpdateComment = `${pluralize(
              'record',
              newRecords.length,
              true
            )} added to whitelist for '${hit.hitContext.userId}' user`
          }
        }
      }
    }

    return whitelistUpdateComment
  }

  /*
    Methods to work with hits
   */
  public async searchHits(
    params: {
      filterHitIds?: string[]
      filterSearchId?: string[]
      filterPaymentMethodId?: string[]
      filterStatus?: SanctionsHitStatus[]
      alertId?: string
      ruleId?: string
      filterUserId?: string
      filterScreeningHitEntityType?: SanctionsDetailsEntityType
    } & CursorPaginationParams
  ): Promise<SanctionsHitListResponse> {
    if (params.alertId) {
      const alertsRepository = new AlertsRepository(this.tenantId, {
        mongoDb: await getMongoDbClient(),
        dynamoDb: getDynamoDbClient(),
      })
      const alert = await alertsRepository.getAlertById(params.alertId)
      if (alert) {
        if (params.filterPaymentMethodId) {
          params.filterSearchId = undefined
        }
        params.filterHitIds = alert.ruleHitMeta?.sanctionsDetails
          ?.filter((data) => {
            if (params.filterPaymentMethodId) {
              return params.filterPaymentMethodId.includes(
                data.hitContext?.paymentMethodId ?? ''
              )
            }
            if (params.filterSearchId) {
              return (
                params.filterSearchId.includes(data.searchId) &&
                (!params.filterScreeningHitEntityType ||
                  data.entityType === params.filterScreeningHitEntityType)
              )
            }
            return false
          })
          .flatMap(({ sanctionHitIds }) => sanctionHitIds ?? [])
        params.ruleId = alert.ruleId
        params.filterUserId =
          alert.ruleHitMeta?.sanctionsDetails?.[0]?.hitContext?.userId ??
          undefined
      }
    }

    return await this.sanctionsHitsRepository.searchHits(params)
  }

  private async addComments(
    alertId: string,
    sanctionHitIds: string[],
    updates: SanctionHitStatusUpdateRequest,
    whitelistUpdateComment: string | null
  ): Promise<void> {
    const isSingleHit = sanctionHitIds.length === 1
    const reasonsComment = AlertsService.formatReasonsComment(updates)

    // Add user comment
    const caseItem = await this.caseService.getCaseByAlertId(alertId)
    const userId =
      caseItem?.caseUsers?.origin?.userId ??
      caseItem?.caseUsers?.destination?.userId ??
      null

    if (userId != null) {
      let userCommentBody = `${sanctionHitIds.join(', ')} ${
        isSingleHit ? 'hit is' : 'hits are'
      } are moved to "${updates.status}" status from alert '${alertId}'`
      if (reasonsComment !== '') {
        userCommentBody += `. Reasons: ` + reasonsComment
      }
      if (whitelistUpdateComment !== '') {
        userCommentBody += `. ${whitelistUpdateComment}`
      }
      if (updates?.comment) {
        userCommentBody += `\n\nComment: ${updates.comment}`
      }
      await this.userService.saveUserComment(userId, {
        body: userCommentBody,
        files: updates.files,
      })
    }

    // Add alert comment
    let alertCommentBody = `${sanctionHitIds.join(', ')} ${
      isSingleHit ? 'hit is' : 'hits are'
    } moved to "${updates.status}" status`
    if (reasonsComment !== '') {
      alertCommentBody += `. Reasons: ` + reasonsComment
    }
    if (whitelistUpdateComment) {
      alertCommentBody += `. ${whitelistUpdateComment}`
    }
    if (updates?.comment) {
      alertCommentBody += `\n\nComment: ${updates.comment}`
    }
    await this.alertsService.saveComment(alertId, {
      body: alertCommentBody,
      files: updates.files,
    })
  }

  public async addWhitelistEntities(
    provider: SanctionsDataProviderName,
    entities: SanctionsEntity[],
    subject: WhitelistSubject,
    options?: {
      reason?: string[]
      comment?: string
      createdAt?: number
    }
  ) {
    return await this.sanctionsWhitelistEntityRepository.addWhitelistEntities(
      provider,
      entities,
      subject,
      options
    )
  }
}
