import { listsHandler } from '../app'
import { ListClearRequest } from '@/@types/openapi-public-management/ListClearRequest'
import { getApiGatewayPostEvent } from '@/test-utils/apigateway-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { ListAppendRequest } from '@/@types/openapi-public-management/ListAppendRequest'

dynamoDbSetupHook()

describe('listsHandler', () => {
  it('should clear list items when operation is CLEAR', async () => {
    const tenantId = getTestTenantId()
    const event = getApiGatewayPostEvent(tenantId, '/lists', {
      operation: 'CLEAR',
      listId: 'test-list-id',
    } as ListClearRequest)

    const response = await listsHandler(event, null as any, null as any)
    expect(response).toBeDefined()
    expect((response as any).statusCode).toBe(404)
  })

  it('should update or create list when operation is APPEND', async () => {
    const tenantId = getTestTenantId()
    const event = getApiGatewayPostEvent(tenantId, '/lists', {
      operation: 'APPEND',
      listId: 'test-list-id',
      data: {
        items: [
          {
            key: 'test-key',
          },
        ],
      },
      listType: 'BLACKLIST',
      subtype: 'USER_ID',
    } as ListAppendRequest)

    const response = await listsHandler(event, null as any, null as any)
    expect(response).toBeDefined()
    expect((response as any).statusCode).toBe(200)
    expect((response as any).body).toBe(
      JSON.stringify({
        listId: 'test-list-id',
        message: 'List updated successfully',
        status: 'SUCCESS',
      })
    )

    // to clear the list
    const clearEvent = getApiGatewayPostEvent(tenantId, '/lists', {
      operation: 'CLEAR',
      listId: 'test-list-id',
    } as ListClearRequest)

    const clearResponse = await listsHandler(
      clearEvent,
      null as any,
      null as any
    )
    expect(clearResponse).toBeDefined()
    expect((clearResponse as any).statusCode).toBe(200)
  })
})
