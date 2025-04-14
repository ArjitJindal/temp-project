import * as fs from 'fs'
import * as yaml from 'js-yaml'
import { cloneDeep, omit, uniq } from 'lodash'
import { StackConstants } from '../constants'
import { isValidResource } from '@/services/rbac/utils/permissions'

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

/**
 * AWS APIGateway request validator detail error messagae doesn't work well for `allOf`.
 * For example, `allOf[A, B]`, and we have a missing required parameter in A,
 * the error message will just say:
 * "instance failed to match all required schemas (matched only 1 out of 2)"
 * This is the workaround to "flatten" the schema (recursively) to have better error message.
 */
function flattenAndDeRefAllOf(schema: any, schemas: any) {
  if (schema.properties) {
    for (const propertyKey in schema.properties) {
      schema.properties[propertyKey] = flattenAndDeRefAllOf(
        schema.properties[propertyKey],
        schemas
      )
    }
    return schema
  }

  if (schema.allOf) {
    const newSchema: any = {
      type: 'object',
      properties: {},
    }
    for (const subSchema of schema.allOf || []) {
      let s = subSchema
      if ('$ref' in subSchema) {
        const refSchemaKey = subSchema['$ref'].replace(
          '#/components/schemas/',
          ''
        )
        s = schemas[refSchemaKey]
        if (!s) {
          continue
        }
      }
      s = flattenAndDeRefAllOf(s, schemas)
      newSchema.properties = {
        ...newSchema.properties,
        ...cloneDeep(s.properties),
      }
      if (s.required?.length > 0) {
        newSchema.required = (newSchema.required ?? []).concat(s.required)
      }
    }
    newSchema.required = uniq([
      ...(newSchema.required ?? []),
      ...(schema.required ?? []),
    ])
    return newSchema
  }
  return schema
}

export function getAugmentedOpenapi(
  openapiPath: string,
  pathToLambda: { [key: string]: string },
  authorization: AuthorizationType,
  options?: {
    iamAuthorizedPaths?: string[]
    publicPaths?: string[]
    allowedOrigins?: string[]
  }
) {
  const openapi = yaml.load(fs.readFileSync(openapiPath, 'utf8')) as any
  assertValidLambdaMappings(openapi, pathToLambda)

  // Filter out not-yet-implemented paths
  openapi.paths = omit(
    openapi.paths,
    Object.keys(pathToLambda).filter((path) => !pathToLambda[path])
  )

  // Request validator setting
  openapi['x-amazon-apigateway-request-validators'] = {
    all: {
      validateRequestBody: true,
      validateRequestParameters: true,
    },
    paramsOnly: {
      validateRequestBody: false,
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
    (authorization === 'API_KEY'
      ? StackConstants.API_KEY_AUTHORIZER_CACHE_TTL_SECONDS
      : StackConstants.JWT_AUTHORIZER_CACHE_TTL_SECONDS) - 600
  openapi['components']['securitySchemes']['lambda-authorizer'] = {
    type: 'apiKey',
    name: 'Authorization',
    in: 'header',
    'x-amazon-apigateway-authorizer': {
      type: 'request',
      identitySource: `method.request.header.${
        authorization === 'API_KEY' ? 'x-api-key' : 'authorization'
      }`,
      authorizerUri: `arn:aws:apigateway:{{region}}:lambda:path/2015-03-31/functions/arn:aws:lambda:{{region}}:{{accountId}}:function:{{${authorizationFunctionName}}}:${StackConstants.LAMBDA_LATEST_ALIAS_NAME}/invocations`,
      authorizerResultTtlInSeconds,
      enableSimpleResponses: false,
    },
    'x-amazon-apigateway-authtype': 'Custom scheme with tenant claims',
  }

  // Apache Velocity Template for handling CORS
  // (syntax ref: https://velocity.apache.org/engine/1.7/user-guide.html)
  const allowedOrigins = options?.allowedOrigins || ['*']
  const corsHandlerCode = `
    {"statusCode": 200}
    $input.json("$")
    #set($domains = [${allowedOrigins.map((v) => `"${v}"`).join(',')}])
    #set($origin = $input.params("origin"))
    #if($domains.contains($origin) || $domains.contains("*"))
    #set($context.responseOverride.header.Access-Control-Allow-Origin="$origin")
    #end
`

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
      if (!methodSetting['x-amazon-apigateway-request-validator']) {
        methodSetting['x-amazon-apigateway-request-validator'] = 'all'
      }
      methodSetting['x-amazon-apigateway-integration'] = {
        uri: `arn:aws:apigateway:{{region}}:lambda:path/2015-03-31/functions/arn:aws:lambda:{{region}}:{{accountId}}:function:{{${lambdaFunctionName}}}:${StackConstants.LAMBDA_LATEST_ALIAS_NAME}/invocations`,
        httpMethod: 'POST',
        type: 'aws_proxy',
        passthroughBehavior: 'never',
      }

      // Validate x-flagright structure
      if (methodSetting['x-flagright']) {
        const flagrightExtension = methodSetting['x-flagright']

        if (flagrightExtension['permissions']) {
          flagrightExtension['permissions'].forEach((p: string) => {
            if (openapi.components.schemas['Permission'].enum.indexOf(p) < 0) {
              throw new Error(`Invalid x-flagright permission: ${p}`)
            }
          })
        }

        if (flagrightExtension['resources']) {
          const schema = openapi.paths[path]
          const parentPathParameters = schema?.parameters
            ?.filter((p: any) => p.in === 'path')
            .map((p: any) => p.name)
          const pathParameterNames = Object.keys(schema).flatMap((key) =>
            schema[key].parameters
              .filter((p: any) => p.in === 'path')
              .map((p: any) => p.name)
          )

          const allPathParameters = new Set([
            ...(parentPathParameters ?? []),
            ...(pathParameterNames ?? []),
          ])

          flagrightExtension['resources'].forEach((r: string) => {
            const [action, resource] = r.split(':::')
            if (action !== 'read' && action !== 'write') {
              throw new Error(`Invalid x-flagright action: ${action}`)
            }
            if (!isValidResource(resource, [action])) {
              throw new Error(`Invalid x-flagright resource: ${r}`)
            }

            // get everything which is in format {paramName} and remove paranthesis
            const paramNames = resource
              .match(/{(\w+)}/g)
              ?.map((p) => p.replace('{', '').replace('}', ''))

            // if narrative Template id in paramNames but not in pathParameterNamesSet, throw error
            if (paramNames?.some((p) => !allPathParameters.has(p))) {
              throw new Error(
                `Path parameter ${paramNames?.find(
                  (p) => !allPathParameters.has(p)
                )} is required but not in path parameters`
              )
            }
          })
        }
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
          'application/json': corsHandlerCode,
        },
        responses: {
          default: {
            statusCode: 200,
            responseParameters: {
              'method.response.header.Access-Control-Allow-Headers': "'*'",
              'method.response.header.Access-Control-Allow-Methods': "'*'",
            },
          },
        },
      },
    }
  }

  // Flatten allOf
  openapi.components.schemas = flattenSchemas(openapi.components.schemas)
  return openapi
}

export function flattenSchemas(schemas: any) {
  for (const schemaKey in schemas) {
    schemas[schemaKey] = flattenAndDeRefAllOf(schemas[schemaKey], schemas)
  }
  return schemas
}
