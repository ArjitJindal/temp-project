import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { assertPermissions, JWTAuthorizerResult } from '@/@types/jwt'
import { getApiRequiredPermissions as getInternalApiRequiredPermissions } from '@/@types/openapi-internal-custom/DefaultApi'
import { getApiRequiredPermissions as getPublicApiRequiredPermissions } from '@/@types/openapi-public-custom/DefaultApi'
import { getApiRequiredPermissions as getPublicManagementApiRequiredPermissions } from '@/@types/openapi-public-management-custom/DefaultApi'
import { getApiRequiredPermissions as getPublicDeviceDataApiRequiredPermissions } from '@/@types/openapi-public-device-data-custom/DefaultApi'
import { determineApi } from '@/core/utils/api'
import { Permission } from '@/@types/openapi-internal/Permission'
import { logger } from '@/core/logger'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<
    AWS.STS.Credentials & JWTAuthorizerResult
  >
>

export const rbacMiddleware =
  () =>
  (handler: CallableFunction): Handler =>
  async (event, ctx): Promise<APIGatewayProxyResult> => {
    let getApiRequiredPermissions: (
      resource: string,
      method: string
    ) => Permission[]

    const api = determineApi(ctx)
    switch (api) {
      case 'CONSOLE':
        getApiRequiredPermissions = getInternalApiRequiredPermissions
        break
      case 'PUBLIC':
        getApiRequiredPermissions = getPublicApiRequiredPermissions
        break
      case 'PUBLIC_DEVICE_DATA':
        getApiRequiredPermissions = getPublicDeviceDataApiRequiredPermissions
        break
      case 'PUBLIC_MANAGEMENT':
        getApiRequiredPermissions = getPublicManagementApiRequiredPermissions
        break
      default:
        logger.error('Unable to determine API, RBAC bypassed')
        return await handler(event, ctx)
    }
    const requiredPermissions = getApiRequiredPermissions(
      event.resource,
      event.httpMethod
    )
    assertPermissions(requiredPermissions)
    return await handler(event, ctx)
  }
