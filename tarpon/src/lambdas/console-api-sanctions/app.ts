import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { SanctionsService } from '@/services/sanctions'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import {
  DefaultApiDeleteSanctionsWhitelistRecordsRequest,
  DefaultApiGetSearchProfilesRequest,
  DefaultApiPostSearchProfilesRequest,
  DefaultApiSearchSanctionsHitsRequest,
  DefaultApiUpdateSearchProfileRequest,
  DefaultApiDeleteSearchProfileRequest,
  DefaultApiGetScreeningProfilesRequest,
  DefaultApiPostScreeningProfilesRequest,
  DefaultApiUpdateScreeningProfileRequest,
  DefaultApiDeleteScreeningProfileRequest,
  DefaultApiPostDefaultManualScreeningFiltersRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { SearchProfileService } from '@/services/search-profile'
import { ScreeningProfileService } from '@/services/screening-profile'
import { CounterRepository } from '@/services/counter/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DefaultFiltersService } from '@/services/default-filters'

export const sanctionsHandler = lambdaApi({ requiredFeatures: ['SANCTIONS'] })(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const sanctionsService = await SanctionsService.fromEvent(event)
    const handlers = new Handlers()

    handlers.registerPostSanctions(
      async (ctx, request) =>
        await sanctionsService.search(request.SanctionsSearchRequest)
    )

    handlers.registerGetSanctionsSources(async (ctx, request) => {
      const sources = await sanctionsService.getSanctionsSources(
        request.filterSourceType,
        request.searchTerm
      )
      return sources
    })

    handlers.registerGetSanctionsSearch(
      async (ctx, request) => await sanctionsService.getSearchHistories(request)
    )

    handlers.registerGetSanctionsSearchSearchId(
      async (ctx, request) =>
        await sanctionsService.getSearchHistory(
          request.searchId,
          request.page,
          request.pageSize
        )
    )

    handlers.registerGetSanctionsScreeningActivityStats(
      async (_ctx, request) => {
        if (!request.afterTimestamp || !request.beforeTimestamp) {
          return await sanctionsService.getSanctionsScreeningStats()
        }

        return await sanctionsService.getSanctionsScreeningStats({
          from: request.afterTimestamp,
          to: request.beforeTimestamp,
        })
      }
    )

    handlers.registerGetSanctionsScreeningActivityDetails(
      async (_ctx, request) => {
        return await sanctionsService.getSanctionsScreeningDetails(request)
      }
    )

    handlers.registerSearchSanctionsHits(
      async (_ctx, request: DefaultApiSearchSanctionsHitsRequest) => {
        return await sanctionsService.searchHits({
          ...request,
          pageSize: request.pageSize,
          fromCursorKey: request.start,
          sortField: request.sortField,
          sortOrder: request.sortOrder,
        })
      }
    )

    handlers.registerSearchSanctionsWhitelist(
      async (_ctx, request: DefaultApiSearchSanctionsHitsRequest) => {
        const result = await sanctionsService.searchWhitelistEntities({
          ...request,
          pageSize: request.pageSize,
          fromCursorKey: request.start,
          sortField: request.sortField,
          sortOrder: request.sortOrder,
        })
        return result
      }
    )

    handlers.registerDeleteSanctionsWhitelistRecords(
      async (
        _ctx,
        request: DefaultApiDeleteSanctionsWhitelistRecordsRequest
      ) => {
        const { request_body = [] } = request
        await sanctionsService.deleteWhitelistRecord(request_body)
      }
    )

    handlers.registerChangeSanctionsHitsStatus(
      async (_ctx, { SanctionHitsStatusUpdateRequest }) => {
        const { alertId, sanctionHitIds, updates } =
          SanctionHitsStatusUpdateRequest

        return await sanctionsService.changeSanctionsHitsStatus(
          alertId,
          sanctionHitIds,
          updates
        )
      }
    )

    handlers.registerPostSearchProfiles(
      async (_ctx, request: DefaultApiPostSearchProfilesRequest) => {
        const mongoDb = await getMongoDbClient()
        const counterRepository = new CounterRepository(tenantId, mongoDb)
        const searchProfileService = new SearchProfileService(
          tenantId,
          counterRepository
        )
        const dynamoDb = getDynamoDbClient()
        return await searchProfileService.createSearchProfile(
          dynamoDb,
          request.SearchProfileRequest
        )
      }
    )

    handlers.registerGetSearchProfiles(
      async (_ctx, request: DefaultApiGetSearchProfilesRequest) => {
        const mongoDb = await getMongoDbClient()
        const counterRepository = new CounterRepository(tenantId, mongoDb)
        const searchProfileService = new SearchProfileService(
          tenantId,
          counterRepository
        )
        const dynamoDb = getDynamoDbClient()
        return await searchProfileService.getSearchProfiles(
          dynamoDb,
          request.filterSearchProfileId,
          request.filterSearchProfileName,
          request.filterSearchProfileStatus
        )
      }
    )

    handlers.registerUpdateSearchProfile(
      async (_ctx, request: DefaultApiUpdateSearchProfileRequest) => {
        const mongoDb = await getMongoDbClient()
        const counterRepository = new CounterRepository(tenantId, mongoDb)
        const searchProfileService = new SearchProfileService(
          tenantId,
          counterRepository
        )
        const dynamoDb = getDynamoDbClient()
        return await searchProfileService.updateSearchProfile(
          dynamoDb,
          request.searchProfileId,
          request.SearchProfileRequest
        )
      }
    )

    handlers.registerDeleteSearchProfile(
      async (_ctx, request: DefaultApiDeleteSearchProfileRequest) => {
        const mongoDb = await getMongoDbClient()
        const counterRepository = new CounterRepository(tenantId, mongoDb)
        const searchProfileService = new SearchProfileService(
          tenantId,
          counterRepository
        )
        const dynamoDb = getDynamoDbClient()
        return await searchProfileService.deleteSearchProfile(
          dynamoDb,
          request.searchProfileId
        )
      }
    )

    handlers.registerPostScreeningProfiles(
      async (_ctx, request: DefaultApiPostScreeningProfilesRequest) => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const counterRepository = new CounterRepository(tenantId, mongoDb)
        const screeningProfileService = new ScreeningProfileService(
          tenantId,
          counterRepository
        )
        return await screeningProfileService.createScreeningProfile(
          dynamoDb,
          request.ScreeningProfileRequest
        )
      }
    )

    handlers.registerGetScreeningProfiles(
      async (_ctx, request: DefaultApiGetScreeningProfilesRequest) => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const counterRepository = new CounterRepository(tenantId, mongoDb)
        const screeningProfileService = new ScreeningProfileService(
          tenantId,
          counterRepository
        )
        return await screeningProfileService.getScreeningProfiles(
          dynamoDb,
          request.filterScreeningProfileId,
          request.filterScreeningProfileName,
          request.filterScreeningProfileStatus
        )
      }
    )

    handlers.registerUpdateScreeningProfile(
      async (_ctx, request: DefaultApiUpdateScreeningProfileRequest) => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const counterRepository = new CounterRepository(tenantId, mongoDb)
        const screeningProfileService = new ScreeningProfileService(
          tenantId,
          counterRepository
        )
        return await screeningProfileService.updateScreeningProfile(
          dynamoDb,
          request.screeningProfileId,
          request.ScreeningProfileRequest
        )
      }
    )

    handlers.registerDeleteScreeningProfile(
      async (_ctx, request: DefaultApiDeleteScreeningProfileRequest) => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const counterRepository = new CounterRepository(tenantId, mongoDb)
        const screeningProfileService = new ScreeningProfileService(
          tenantId,
          counterRepository
        )
        return await screeningProfileService.deleteScreeningProfile(
          dynamoDb,
          request.screeningProfileId
        )
      }
    )

    handlers.registerGetDefaultManualScreeningFilters(async (_ctx) => {
      const defaultFiltersService = new DefaultFiltersService(tenantId)
      const dynamoDb = getDynamoDbClient()
      return await defaultFiltersService.getDefaultFilters(dynamoDb)
    })

    handlers.registerPostDefaultManualScreeningFilters(
      async (
        _ctx,
        request: DefaultApiPostDefaultManualScreeningFiltersRequest
      ) => {
        const defaultFiltersService = new DefaultFiltersService(tenantId)
        const dynamoDb = getDynamoDbClient()
        return await defaultFiltersService.createDefaultFilters(
          request.DefaultManualScreeningFiltersRequest,
          dynamoDb
        )
      }
    )
    return await handlers.handle(event)
  }
)
