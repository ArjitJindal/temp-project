import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Handler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { getTestTenantId } from './tenant-test-utils'
import { JWTAuthorizerResult } from '@/@types/jwt'

function getPathFromPathParams(
  resource: string,
  pathParameters: { [key: string]: string } | undefined
): string {
  if (!pathParameters) {
    return resource
  }
  let path = resource
  for (const pathKey in pathParameters) {
    path = path.replace(`{${pathKey}}`, pathParameters[pathKey])
  }
  return path
}

export function getApiGatewayGetEvent(
  tenantId: string,
  resource: string,
  params?: {
    pathParameters?: { [key: string]: string }
    queryStringParameters?: { [key: string]: string }
    user?: Partial<JWTAuthorizerResult>
  }
): APIGatewayProxyWithLambdaAuthorizerEvent<
  APIGatewayEventLambdaAuthorizerContext<Credentials>
> {
  return {
    resource,
    path: getPathFromPathParams(resource, params?.pathParameters),
    httpMethod: 'GET',
    queryStringParameters: params?.queryStringParameters || {},
    pathParameters: params?.pathParameters || {},
    requestContext: {
      authorizer: {
        principalId: tenantId,
        ...(params?.user ?? {}),
      },
    } as any,
    body: null,
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    multiValueQueryStringParameters: {},
    stageVariables: null,
  }
}

export function getApiGatewayPostEvent(
  tenantId: string,
  resource: string,
  body: object,
  params?: {
    pathParameters?: { [key: string]: string }
    queryStringParameters?: { [key: string]: string }
    user?: Partial<JWTAuthorizerResult>
  }
): APIGatewayProxyWithLambdaAuthorizerEvent<
  APIGatewayEventLambdaAuthorizerContext<Credentials>
> {
  return {
    resource,
    path: getPathFromPathParams(resource, params?.pathParameters),
    httpMethod: 'POST',
    queryStringParameters: params?.queryStringParameters || {},
    pathParameters: params?.pathParameters || {},
    requestContext: {
      authorizer: {
        principalId: tenantId,
        ...(params?.user ?? {}),
      },
    } as any,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    multiValueQueryStringParameters: {},
    stageVariables: null,
  }
}

export function getApiGatewayPatchEvent(
  tenantId: string,
  resource: string,
  body: object,
  params?: {
    pathParameters?: { [key: string]: string }
    queryStringParameters?: { [key: string]: string }
    user?: Partial<JWTAuthorizerResult>
  }
): APIGatewayProxyWithLambdaAuthorizerEvent<
  APIGatewayEventLambdaAuthorizerContext<Credentials>
> {
  return {
    resource,
    path: getPathFromPathParams(resource, params?.pathParameters),
    httpMethod: 'PATCH',
    queryStringParameters: params?.queryStringParameters || {},
    pathParameters: params?.pathParameters || {},
    requestContext: {
      authorizer: {
        principalId: tenantId,
        ...(params?.user ?? {}),
      },
    } as any,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    multiValueQueryStringParameters: {},
    stageVariables: null,
  }
}

export function getApiGatewayDeleteEvent(
  tenantId: string,
  resource: string,
  params?: {
    pathParameters?: { [key: string]: string }
    queryStringParameters?: { [key: string]: string }
    user?: Partial<JWTAuthorizerResult>
  }
): APIGatewayProxyWithLambdaAuthorizerEvent<
  APIGatewayEventLambdaAuthorizerContext<Credentials>
> {
  return {
    resource,
    path: getPathFromPathParams(resource, params?.pathParameters),
    httpMethod: 'DELETE',
    queryStringParameters: params?.queryStringParameters || {},
    pathParameters: params?.pathParameters || {},
    requestContext: {
      authorizer: {
        principalId: tenantId,
        ...(params?.user ?? {}),
      },
    } as any,
    body: null,
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    multiValueQueryStringParameters: {},
    stageVariables: null,
  }
}

export function getApiGatewayPutEvent(
  tenantId: string,
  resource: string,
  body: object,
  params?: {
    pathParameters?: { [key: string]: string }
    queryStringParameters?: { [key: string]: string }
    user?: Partial<JWTAuthorizerResult>
  }
): APIGatewayProxyWithLambdaAuthorizerEvent<
  APIGatewayEventLambdaAuthorizerContext<Credentials>
> {
  return {
    resource,
    path: getPathFromPathParams(resource, params?.pathParameters),
    httpMethod: 'PUT',
    queryStringParameters: params?.queryStringParameters || {},
    pathParameters: params?.pathParameters || {},
    requestContext: {
      authorizer: {
        principalId: tenantId,
        ...(params?.user ?? {}),
      },
    } as any,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    multiValueQueryStringParameters: {},
    stageVariables: null,
  }
}

export function mockStaticMethod(
  service: any,
  methodName: string,
  returnValue?: any
) {
  const mock = jest.spyOn(service, methodName)
  if (returnValue) {
    mock.mockReturnValue(returnValue)
  }
  return mock
}

export type TestApiEndpointOptions = {
  method: string
  path: string
  payload?: any
}

export class TestApiEndpoint {
  lambdaHandler: Handler
  tenantId: string

  constructor(lambdaHandler: Handler) {
    this.lambdaHandler = lambdaHandler
    this.tenantId = getTestTenantId()
  }

  public testApi(endpoint: { method: string; path: string; payload?: any }) {
    const { method, path, payload } = endpoint
    test(`${method} ${path} should be handled`, async () => {
      let event
      switch (method) {
        case 'GET':
          event = getApiGatewayGetEvent(this.tenantId, path, {
            queryStringParameters: payload,
            pathParameters: payload,
          })
          break
        case 'POST':
          event = getApiGatewayPostEvent(this.tenantId, path, payload || {}, {
            queryStringParameters: payload,
            pathParameters: payload,
          })
          break
        case 'DELETE':
          event = getApiGatewayDeleteEvent(this.tenantId, path, {
            pathParameters: payload,
            queryStringParameters: payload,
          })

          break
        case 'PATCH':
          event = getApiGatewayPatchEvent(this.tenantId, path, payload || {}, {
            pathParameters: payload,
            queryStringParameters: payload,
          })
          break
        case 'PUT':
          event = getApiGatewayPutEvent(this.tenantId, path, payload || {}, {
            pathParameters: payload,
            queryStringParameters: payload,
          })
          break
        default:
          throw new Error(`Unsupported method ${method}`)
      }
      const response = await this.lambdaHandler(event, null as any, null as any)
      expect(JSON.parse(response.body)?.message).not.toBe(
        'No handler registered'
      )
    })
  }
}
