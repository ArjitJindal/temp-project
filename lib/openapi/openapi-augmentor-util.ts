import * as fs from 'fs'
import * as yaml from 'js-yaml'
import _ from 'lodash'
import { StackConstants } from '../constants'

type PathToLambda = { [key: string]: string }
type AuthorizationType = 'JWT' | 'API_KEY'

function assertValidLambdaMappings(openapi: any, pathToLambda: PathToLambda) {
  const pathsLocal = Object.keys(pathToLambda)
  const pathsRemote = Object.keys(openapi.paths)
  if (
    pathsLocal.length !== pathsRemote.length ||
    new Set([...pathsLocal, ...pathsRemote]).size !== pathsRemote.length
  ) {
    throw new Error(
      `Paths in PathToLambda are not in sync with remote public openapi paths. Please update PathToLambda. 
       
       Local: ${pathsLocal}. 
 
       Remote: ${pathsRemote}
 
       Diff: ${pathsLocal
         .filter((path) => !pathsRemote.includes(path))
         .concat(pathsRemote.filter((path) => !pathsLocal.includes(path)))}\n`
    )
  }
}

export function getAugmentedOpenapi(
  openapiPath: string,
  pathToLambda: { [key: string]: string },
  authorization: AuthorizationType,
  options?: {
    iamAuthorizedPaths?: string[]
    publicPaths?: string[]
    allowedOrigin?: string
  }
) {
  const openapi = yaml.load(fs.readFileSync(openapiPath, 'utf8')) as any
  assertValidLambdaMappings(openapi, pathToLambda)

  // Filter out not-yet-implemented paths
  openapi.paths = _.omit(
    openapi.paths,
    Object.keys(pathToLambda).filter((path) => !pathToLambda[path])
  )

  // Request validator setting
  openapi['x-amazon-apigateway-request-validators'] = {
    all: {
      validateRequestBody: true,
      validateRequestParameters: true,
    },
  }

  if (authorization === 'API_KEY') {
    // API key setting
    openapi['components']['securitySchemes']['x-api-key'][
      'x-amazon-apigateway-api-key-source'
    ] = 'HEADER'
  }

  if (options?.iamAuthorizedPaths?.length) {
    // IAM authorization setting
    openapi['components']['securitySchemes']['sigv4'] = {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
      'x-amazon-apigateway-authtype': 'awsSigv4',
    }
  }

  // Labmda authorizer setting
  const authorizationFunctionName =
    authorization === 'API_KEY'
      ? StackConstants.API_KEY_AUTHORIZER_FUNCTION_NAME
      : StackConstants.JWT_AUTHORIZER_FUNCTION_NAME
  const authorizerResultTtlInSeconds =
    authorization === 'API_KEY'
      ? StackConstants.API_KEY_AUTHORIZER_CACHE_TTL_SECONDS
      : StackConstants.JWT_AUTHORIZER_CACHE_TTL_SECONDS
  openapi['components']['securitySchemes']['lambda-authorizer'] = {
    type: 'apiKey',
    name: 'Authorization',
    in: 'header',
    'x-amazon-apigateway-authorizer': {
      type: 'request',
      identitySource: `method.request.header.${
        authorization === 'API_KEY' ? 'x-api-key' : 'authorization'
      }`,
      authorizerUri: {
        'Fn::Sub': `arn:aws:apigateway:\${AWS::Region}:lambda:path/2015-03-31/functions/\${${authorizationFunctionName}.Arn}:${StackConstants.LAMBDA_LATEST_ALIAS_NAME}/invocations`,
      },
      authorizerResultTtlInSeconds,
      enableSimpleResponses: false,
    },
    'x-amazon-apigateway-authtype': 'Custom scheme with tenant claims',
  }

  // Labmda integrations
  for (const path in openapi.paths) {
    // NOTE: path parameters should live under method in API Gateway. Move the path-level
    // parameters to each method
    const pathParameters = openapi.paths[path]['parameters']
    delete openapi.paths[path]['parameters']

    for (const method in openapi.paths[path]) {
      const methodSetting = openapi.paths[path][method]

      // Parameters
      if (pathParameters) {
        methodSetting['parameters'] = (
          methodSetting['parameters'] || []
        ).concat(pathParameters)
      }

      // Lambda integration
      const lambdaFunctionName = pathToLambda[path]
      methodSetting['x-amazon-apigateway-request-validator'] = 'all'
      methodSetting['x-amazon-apigateway-integration'] = {
        uri: {
          'Fn::Sub': `arn:aws:apigateway:$\{AWS::Region}:lambda:path/2015-03-31/functions/$\{${lambdaFunctionName}.Arn}:${StackConstants.LAMBDA_LATEST_ALIAS_NAME}/invocations`,
        },
        httpMethod: 'POST',
        type: 'aws_proxy',
        passthroughBehavior: 'never',
      }

      // Security
      if (options?.iamAuthorizedPaths?.includes(path)) {
        methodSetting['x-amazon-apigateway-auth'] = { type: 'AWS_IAM' }
        methodSetting['security'] = [{ sigv4: [] }]
      } else if (!options?.publicPaths?.includes(path)) {
        if (
          authorization === 'API_KEY' &&
          !methodSetting['security']?.find(
            (security: any) => security['x-api-key']
          )
        ) {
          throw new Error(
            `${path} ${method} has missing x-api-key security setting!`
          )
        }
        if (!methodSetting['security']) {
          methodSetting['security'] = []
        }
        methodSetting['security'].push({ 'lambda-authorizer': [] })
      }
    }

    // CORS handling (because we use SpecRestApi, so we need to create OPTIONS method for all child resources by ourselves)
    openapi.paths[path]['options'] = {
      parameters: [],
      responses: {
        '200': {
          description: 'Default response',
          headers: {
            'Access-Control-Allow-Headers': {
              schema: {
                type: 'string',
              },
            },
            'Access-Control-Allow-Methods': {
              schema: {
                type: 'string',
              },
            },
            'Access-Control-Allow-Origin': {
              schema: {
                type: 'string',
              },
            },
          },
        },
      },
      'x-amazon-apigateway-integration': {
        type: 'mock',
        requestTemplates: {
          'application/json': '{"statusCode":200}',
        },
        responses: {
          default: {
            statusCode: 200,
            responseParameters: {
              'method.response.header.Access-Control-Allow-Headers': "'*'",
              'method.response.header.Access-Control-Allow-Methods': "'*'",
              'method.response.header.Access-Control-Allow-Origin': `'${
                options?.allowedOrigin || '*'
              }'`,
            },
          },
        },
      },
    }
  }

  return openapi
}
