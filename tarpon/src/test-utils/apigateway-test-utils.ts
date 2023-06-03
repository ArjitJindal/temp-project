import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'

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
  }
): APIGatewayProxyWithLambdaAuthorizerEvent<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
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
      },
    } as any,
    body: null,
    headers: {},
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
  }
): APIGatewayProxyWithLambdaAuthorizerEvent<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
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
      },
    } as any,
    body: JSON.stringify(body),
    headers: {},
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
  }
): APIGatewayProxyWithLambdaAuthorizerEvent<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
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
      },
    } as any,
    body: JSON.stringify(body),
    headers: {},
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
  }
): APIGatewayProxyWithLambdaAuthorizerEvent<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
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
      },
    } as any,
    body: null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    multiValueQueryStringParameters: {},
    stageVariables: null,
  }
}
