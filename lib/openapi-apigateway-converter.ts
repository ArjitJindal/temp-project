/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * This script injects AWS API Gateway specific settings into our public openapi and output to lib/openapi.yaml
 */

import * as fs from 'fs'
import * as yaml from 'js-yaml'

const PathToLambda: any = {
  '/transactions': 'tarponTransactionFunction',
  '/transactions/{transactionId}': 'tarponTransactionFunction',
  '/consumer/users': 'tarponUserFunction',
  '/consumer/users/{userId}': 'tarponUserFunction',
  '/business/users': 'tarponUserFunction',
  '/business/users/{userId}': 'tarponUserFunction',
}

function assertValidLambdaMappings(openapi: any) {
  const pathsLocal = Object.keys(PathToLambda)
  const pathsRemote = Object.keys(openapi.paths)
  if (
    pathsLocal.length !== pathsRemote.length ||
    new Set([...pathsLocal, ...pathsRemote]).size !== pathsRemote.length
  ) {
    console.log('Local paths: ', pathsLocal)
    console.log('Remote paths: ', pathsRemote)
    throw new Error(
      'paths in PathToLambda are not in sync with remote openapi paths. Please update PathToLambda'
    )
  }
}

const openapi = yaml.load(
  fs.readFileSync('./lib/.remote-openapi.yaml', 'utf8')
) as any

assertValidLambdaMappings(openapi)

// Request validator setting
openapi['x-amazon-apigateway-request-validators'] = {
  all: {
    validateRequestBody: true,
    validateRequestParameters: true,
  },
}

// API key setting
openapi['components']['securitySchemes']['x-api-key'][
  'x-amazon-apigateway-api-key-source'
] = 'HEADER'

// Labmda authorizer setting
openapi['components']['securitySchemes']['lambda-authorizer'] = {
  type: 'apiKey',
  name: 'Authorization',
  in: 'header',
  'x-amazon-apigateway-authorizer': {
    type: 'request',
    identitySource: 'method.request.header.x-api-key',
    authorizerUri: {
      'Fn::Sub':
        'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${tarponApiKeyAuthorizerFunction.Arn}/invocations',
    },
    authorizerResultTtlInSeconds: 3600,
    enableSimpleResponses: false,
  },
  'x-amazon-apigateway-authtype': 'Custom scheme with tenant claims',
}

// Labmda integrations
for (const path in openapi.paths) {
  for (const method in openapi.paths[path]) {
    const methodSetting = openapi.paths[path][method]
    const lambdaFunctionName = PathToLambda[path]

    methodSetting['x-amazon-apigateway-request-validator'] = 'all'
    methodSetting['x-amazon-apigateway-integration'] = {
      uri: {
        'Fn::Sub': `arn:aws:apigateway:$\{AWS::Region}:lambda:path/2015-03-31/functions/$\{${lambdaFunctionName}.Arn}/invocations`,
      },
      httpMethod: 'POST',
      type: 'aws_proxy',
      passthroughBehavior: 'never',
    }
    methodSetting['security'].push({ 'lambda-authorizer': [] })
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
            'method.response.header.Access-Control-Allow-Methods':
              "'OPTIONS,POST,GET'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      },
    },
  }
}

fs.writeFileSync('./lib/openapi.yaml', yaml.dump(openapi))
