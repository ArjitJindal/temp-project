import {
  ApiResponse,
  DeleteRolesByIdRequest,
  GetOrganizationMemberRoles200ResponseOneOfInner,
  PatchRolesByIdRequest,
  RoleCreate,
  RoleUpdate,
} from 'auth0'
import remove from 'lodash/remove'
import { RoleService } from '..'
import { Auth0RolesRepository } from '../repository/auth0'
import {
  auth0AsyncWrapper,
  getAuth0ManagementClient,
} from '@/utils/auth0-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { Tenant } from '@/@types/tenant'
import { AccountsService } from '@/services/accounts'
jest.mock('@/utils/auth0-utils')
const mockedGetAuth0ManagementClient =
  getAuth0ManagementClient as unknown as jest.Mock

dynamoDbSetupHook()

const mockedAuth0AsyncWrapper = auth0AsyncWrapper as unknown as jest.Mock

jest.spyOn(AccountsService.prototype, 'getTenantById').mockResolvedValue({
  id: 'test-tenant-id',
  name: 'test-tenant-name',
} as Tenant)

jest
  .spyOn(Auth0RolesRepository.prototype, 'getUsersByRole')
  .mockResolvedValue([])

const API_RESPONSE = {
  status: 200,
  statusText: 'OK',
  headers: new Headers(),
}

const TEST_TENANT_ID = 'test-tenant-id'

let TEST_ROLES: { id?: string; name?: string; description?: string }[] = [
  {
    id: 'test-id1',
    name: 'test-name1',
    description: 'test-description1',
  },
  {
    id: 'test-id2',
    name: 'test-name2',
    description: 'test-description2',
  },
]
describe('Test Custom Roles Deletion and Updation', () => {
  beforeEach(() => {
    mockedAuth0AsyncWrapper.mockImplementation(async (asyncFunction) => {
      const result = await asyncFunction()
      return result.data
    })
    mockedGetAuth0ManagementClient.mockImplementation(() => {
      return {
        roles: {
          create: jest
            .fn()
            .mockImplementation(
              async (
                roleData: RoleCreate
              ): Promise<
                ApiResponse<GetOrganizationMemberRoles200ResponseOneOfInner>
              > => {
                TEST_ROLES.push({
                  id: 'test-id',
                  name: roleData.name,
                  description: roleData.description,
                })
                return Promise.resolve({
                  ...API_RESPONSE,
                  data: {
                    id: 'test-id',
                    name: roleData.name,
                    description: roleData.description ?? '',
                  },
                })
              }
            ),
          addPermissions: jest.fn().mockImplementation(async () => {
            return Promise.resolve(null)
          }),
          get: jest.fn().mockImplementation(async () => {
            return Promise.resolve({
              ...API_RESPONSE,
              data: {
                id: 'test-id',
                name: 'test-tenant-id:test-name',
                description: 'test-description',
              },
            })
          }),
          getPermissions: jest.fn().mockImplementation(async () => {
            return Promise.resolve({
              ...API_RESPONSE,
              data: [],
            })
          }),
          update: jest
            .fn()
            .mockImplementation(
              async (idObject: PatchRolesByIdRequest, data: RoleUpdate) => {
                TEST_ROLES = TEST_ROLES.map((role) => {
                  if (role.id === idObject.id) {
                    return {
                      id: role.id,
                      name: data.name,
                      description: data.description,
                    }
                  }
                  return role
                })
                return Promise.resolve(null)
              }
            ),
          getUsers: jest.fn().mockImplementation(async () => {
            return Promise.resolve([])
          }),
          delete: jest
            .fn()
            .mockImplementation(async (idObject: DeleteRolesByIdRequest) => {
              TEST_ROLES = remove(TEST_ROLES, (role) => {
                return role.id !== idObject.id
              })
              return Promise.resolve(null)
            }),
          deletePermissions: jest.fn().mockImplementation(async () => {
            return Promise.resolve(null)
          }),
        },
      }
    })
  })
  test('Test Custom Role creation,updation and deletion', async () => {
    const roleService = RoleService.getInstance(getDynamoDbClient())
    const createdRoleResponse = await roleService.createRole(TEST_TENANT_ID, {
      name: 'test_name',
      description: 'test-description',
      permissions: [],
    })
    const createdRole = createdRoleResponse.result
    expect(createdRole).toEqual({
      id: 'test-id',
      name: 'test_name',
      description: 'test-description',
      permissions: [],
      statements: [],
    })
    expect(TEST_ROLES.length).toEqual(3)

    const updatedRoleResponse = await roleService.updateRole(
      TEST_TENANT_ID,
      'test-id',
      {
        name: 'test-name-updated',
        description: 'test-description-updated',
        id: 'test-id',
        permissions: [],
      }
    )
    const updatedRole = updatedRoleResponse.result
    expect(updatedRole).toEqual({
      id: 'test-id',
      name: 'test-name-updated',
      description: 'test-description-updated',
      permissions: [],
    })
    expect(TEST_ROLES[2]).toEqual({
      id: 'test-id',
      name: 'test-tenant-id:test-name-updated',
      description: 'test-description-updated',
    })

    const deletedRoleResponse = await roleService.deleteRole(
      TEST_TENANT_ID,
      'test-id'
    )
    const deletedRole = deletedRoleResponse.result
    expect(deletedRole).toEqual(undefined)
    expect(TEST_ROLES.length).toEqual(2)
  })
})
