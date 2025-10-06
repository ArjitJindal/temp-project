import { APIGatewayProxyWithLambdaAuthorizerEvent } from 'aws-lambda'
import { rbacMiddleware } from '@/core/middlewares/rbac'

jest.mock('@/core/utils/api', () => ({ determineApi: () => 'CONSOLE' }))
jest.mock('@/utils/dynamodb', () => ({ getDynamoDbClientByEvent: () => ({}) }))
jest.mock('@/core/utils/context', () => ({
  userStatements: jest.fn(async () => [
    {
      actions: ['read'],
      resources: [
        'frn:console:flagright:::case-management/case-status/*',
        'frn:console:flagright:::case-management/alert-status/*',
      ],
      filter: [
        {
          permissionId: 'case-status',
          operator: 'Equals',
          param: 'filterCaseStatus',
          values: ['OPEN', 'CLOSED'],
        },
        {
          permissionId: 'alert-status',
          operator: 'Equals',
          param: 'filterAlertStatus',
          values: ['OPEN', 'CLOSED'],
        },
      ],
    },
  ]),
}))
jest.mock('@/services/sessions', () => ({
  SessionsService: class {
    validateActiveSession = async () => ({})
  },
}))
jest.mock('@/@types/jwt', () => ({
  assertResourceAccess: jest.fn(),
  assertProductionAccess: jest.fn(),
}))

jest.mock('@/@types/openapi-internal-custom/DefaultApi', () => ({
  getApiRequiredResources: (path: string, method: string) => {
    if (path === '/alerts' && method === 'GET') {
      return [
        'frn:console:<default>:::case-management/alert-status/*',
        'frn:console:<default>:::case-management/case-status/*',
      ]
    }
    if (path === '/cases' && method === 'GET') {
      return ['frn:console:<default>:::case-management/case-status/*']
    }
    if (path === '/transactions' && method === 'GET') {
      return ['frn:console:<default>:::transactions/overview']
    }
    return []
  },
  getAlwaysAllowedAccess: () => true,
}))

describe('rbacMiddleware - filter injection', () => {
  const mkEvent = (
    resource: string,
    query: Record<string, string> = {}
  ): any => ({
    resource,
    httpMethod: 'GET',
    path: resource,
    pathParameters: null,
    queryStringParameters: query,
    headers: {},
    requestContext: {
      authorizer: {
        tenantId: 'flagright',
        userId: 'user1',
      },
    },
  })

  test('alerts route injects both filterAlertStatus and filterCaseStatus defaults when missing', async () => {
    const mw = rbacMiddleware()
    const handler = mw(
      async (event: APIGatewayProxyWithLambdaAuthorizerEvent<any>) => ({
        statusCode: 200,
        body: JSON.stringify(event.queryStringParameters),
      })
    )

    const res: any = await handler(
      mkEvent('/alerts') as any,
      { functionName: 'Testing-API' } as any,
      () => undefined
    )
    const qp = JSON.parse(res.body as string)
    expect(qp.filterAlertStatus).toBeTruthy()
    expect(qp.filterCaseStatus).toBeTruthy()
  })

  test('cases route injects only filterCaseStatus defaults when missing', async () => {
    const mw = rbacMiddleware()
    const handler = mw(
      async (event: APIGatewayProxyWithLambdaAuthorizerEvent<any>) => ({
        statusCode: 200,
        body: JSON.stringify(event.queryStringParameters),
      })
    )

    const res: any = await handler(
      mkEvent('/cases') as any,
      { functionName: 'Testing-API' } as any,
      () => undefined
    )
    const qp = JSON.parse(res.body as string)
    expect(qp.filterCaseStatus).toBeTruthy()
    expect(qp.filterAlertStatus).toBeTruthy()
  })

  test('alerts route keeps provided filterAlertStatus and injects missing filterCaseStatus', async () => {
    const mw = rbacMiddleware()
    const handler = mw(
      async (event: APIGatewayProxyWithLambdaAuthorizerEvent<any>) => ({
        statusCode: 200,
        body: JSON.stringify(event.queryStringParameters),
      })
    )

    const res: any = await handler(
      mkEvent('/alerts', { filterAlertStatus: 'OPEN' }) as any,
      { functionName: 'Testing-API' } as any,
      () => undefined
    )
    const qp = JSON.parse(res.body as string)
    expect(qp.filterAlertStatus).toBe('OPEN')
    expect(qp.filterCaseStatus).toBeTruthy()
  })

  test('transactions route injects no filters', async () => {
    const mw = rbacMiddleware()
    const handler = mw(
      async (event: APIGatewayProxyWithLambdaAuthorizerEvent<any>) => ({
        statusCode: 200,
        body: JSON.stringify(event.queryStringParameters),
      })
    )

    const res: any = await handler(
      mkEvent('/transactions') as any,
      { functionName: 'Testing-API' } as any,
      () => undefined
    )
    const qp = JSON.parse(res.body as string)
    expect(qp.filterAlertStatus).toBeUndefined()
    expect(qp.filterCaseStatus).toBeUndefined()
  })
})
