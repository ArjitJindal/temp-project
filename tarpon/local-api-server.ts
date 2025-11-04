import * as fs from 'fs'
import express, { Request, Response } from 'express'
import * as OpenApiValidator from 'express-openapi-validator'
import { connector } from 'swagger-routes-express'
import * as yaml from 'js-yaml'
import { LAMBDAS } from '@lib/lambdas'
import { PublicApiPathToLambda } from '@lib/openapi/openapi-public-augmentor'
import { ConsoleApiPathToLambda } from '@lib/openapi/openapi-internal-augmentor'
import { PublicManagementApiPathToLambda } from '@lib/openapi/openapi-public-management-augmentor'
import { config } from '@flagright/lib/config/config-local'
import chalk from 'chalk'

function loadConfigToEnvs() {
  Object.entries(config.application).forEach((entry) => {
    process.env[entry[0]] = entry[1] as any
  })
  process.env.AWS_REGION = 'eu-central-1'
  process.env.AWS_PROFILE = 'AWSAdministratorAccess-911899431626'
  process.env.TMP_BUCKET = 'tarpon-tmp-dev-eu-central-1'
  process.env.IMPORT_BUCKET = 'tarpon-import-dev-eu-central-1'
  process.env.DOCUMENT_BUCKET = 'tarpon-document-dev-eu-central-1'
  process.env.SHARED_ASSETS_BUCKET = 'tarpon-shared-assets-dev-eu-central-1'
}

function getAllOperationIds(apiDefinition: any) {
  return Object.values(apiDefinition.paths)
    .flatMap((path: any) =>
      Object.values(path).map((method: any) => method.operationId)
    )
    .filter(Boolean)
}

function serverLogMiddleware(req: Request, res: Response, next: any) {
  if (req.method === 'OPTIONS') {
    return next()
  }
  const startTime = new Date()
  console.info(`${startTime.toISOString()} → ${req.method} ${req.url}`)
  res.on('finish', () => {
    const endTime = new Date()
    const status =
      res.statusCode < 400
        ? chalk.green(res.statusCode)
        : chalk.red(res.statusCode)
    const durationInMs = endTime.valueOf() - startTime.valueOf()
    console.info(
      `${endTime.toISOString()} ← ${req.method} ${
        req.url
      } ${status} (${durationInMs}ms)`
    )
  })
  next()
}

type ServerInfo = {
  openapiPath: string
  pathToLambda: { [key: string]: string }
  port: number
}

function createServer(serverInfo: ServerInfo) {
  const app = express()
  const { openapiPath } = serverInfo
  const apiDefinition = yaml.load(fs.readFileSync(openapiPath, 'utf8')) as any
  apiDefinition.servers.forEach((server) => {
    server.url = new URL(server.url).origin
  })

  app.use(express.text({ type: () => true, limit: '10mb' }))
  app.use(express.json({ limit: '10mb' }))
  app.use(serverLogMiddleware)
  app.use(
    OpenApiValidator.middleware({
      apiSpec: apiDefinition,
      validateRequests: false,
      validateResponses: false,
    })
  )

  function addCorsHeaders(res: Response, req?: Request) {
    const requestedHeaders = req?.header('Access-Control-Request-Headers')
    const requestedMethod = req?.header('Access-Control-Request-Method')
    const allowHeaders =
      requestedHeaders ||
      'authorization,x-fingerprint,content-type,accept,origin,x-requested-with,sentry-trace,baggage'
    const allowMethods = requestedMethod || 'GET,POST,PUT,DELETE,OPTIONS'

    res.header('Access-Control-Allow-Headers', allowHeaders)
    res.header('Access-Control-Allow-Methods', allowMethods)
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Max-Age', '7200')
    res.header(
      'Vary',
      'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
    )
  }

  async function handler(req: Request, res: Response) {
    const openapiInfo = (req as any).openapi
    const lambdaName = serverInfo.pathToLambda[openapiInfo.openApiRoute]
    const lambdaHandler = (
      await import(`@/lambdas/${LAMBDAS[lambdaName].codePath}/app`)
    )[LAMBDAS[lambdaName].handlerName]
    const apigatewayEvent = {
      resource: openapiInfo.openApiRoute,
      path: req.url.split('?')[0],
      httpMethod: req.method,
      headers: req.headers,
      body: req.body,
      pathParameters: openapiInfo.pathParams,
      queryStringParameters: req.query,
      requestContext: {},
    }

    try {
      const apigatewayResponse = await lambdaHandler(apigatewayEvent, {
        functionName: lambdaName,
      })
      Object.entries(apigatewayResponse?.headers || {}).forEach((entry) => {
        res.header(entry[0], entry[1] as any)
      })
      addCorsHeaders(res)
      res.status(apigatewayResponse.statusCode)
      res.send(apigatewayResponse.body)
    } catch (e) {
      console.error(e)
      res.status(500)
      res.send('ERROR')
    }
  }

  const handlers = Object.fromEntries(
    getAllOperationIds(apiDefinition).map((operationId) => [
      operationId,
      handler,
    ])
  )
  const connect = connector(handlers, apiDefinition)
  connect(app)

  app.options('*', (req, res) => {
    addCorsHeaders(res, req)
    res.status(200)
    res.send()
  })

  app.listen(serverInfo.port)
  console.info(`Running ${openapiPath} at port ${serverInfo.port}\n`)
}

loadConfigToEnvs()

if (!process.env.API || process.env.API == 'PUBLIC') {
  createServer({
    openapiPath: 'dist/openapi/openapi-public-autogenerated-local.yaml',
    pathToLambda: PublicApiPathToLambda,
    port: 3000,
  })
}

if (!process.env.API || process.env.API == 'PUBLIC_MANAGEMENT') {
  createServer({
    openapiPath:
      'dist/openapi/openapi-public-management-autogenerated-local.yaml',
    pathToLambda: PublicManagementApiPathToLambda,
    port: 3001,
  })
}
if (!process.env.API || process.env.API == 'CONSOLE') {
  createServer({
    openapiPath: 'dist/openapi/openapi-internal-autogenerated-local.yaml',
    pathToLambda: ConsoleApiPathToLambda,
    port: 3002,
  })
}
