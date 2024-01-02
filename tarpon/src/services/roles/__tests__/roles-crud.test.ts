import { CreateRoleData, ObjectWithId, Role, UpdateRoleData } from 'auth0'
import { remove } from 'lodash'
import { RoleService } from '..'
import { getAuth0ManagementClient } from '@/utils/auth0-utils'
jest.mock('@/utils/auth0-utils')
const mockedGetAuth0ManagementClient =
  getAuth0ManagementClient as unknown as jest.Mock

const TEST_TENANT_ID = 'test-tenant-id'
const TEST_DOMAIN = 'test-domain'

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
    mockedGetAuth0ManagementClient.mockImplementation(() => {
      return {
        createRole: jest
          .fn()
          .mockImplementation(
            async (roleData: CreateRoleData): Promise<Role> => {
              TEST_ROLES.push({
                id: 'test-id',
                name: roleData.name,
                description: roleData.description,
              })
              return Promise.resolve({
                id: 'test-id',
                name: roleData.name,
                description: roleData.description,
              })
            }
          ),
        addPermissionsInRole: jest.fn().mockImplementation(async () => {
          return Promise.resolve(null)
        }),
        getRole: jest.fn().mockImplementation(async () => {
          return Promise.resolve({
            id: 'test-id',
            name: 'test-tenant-id:test-name',
            description: 'test-description',
          })
        }),
        getPermissionsInRole: jest.fn().mockImplementation(async () => {
          return Promise.resolve([])
        }),
        updateRole: jest
          .fn()
          .mockImplementation(
            async (idObject: ObjectWithId, data: UpdateRoleData) => {
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
        getUsersInRole: jest.fn().mockImplementation(async () => {
          return Promise.resolve([])
        }),
        deleteRole: jest
          .fn()
          .mockImplementation(async (idObject: ObjectWithId) => {
            TEST_ROLES = remove(TEST_ROLES, (role) => {
              return role.id !== idObject.id
            })
            return Promise.resolve(null)
          }),
        updateRolePermissions: jest.fn().mockImplementation(async () => {
          return Promise.resolve(null)
        }),
        updateUser: jest.fn().mockImplementation(async () => {
          return Promise.resolve(null)
        }),
      }
    })
  })
  test('Test Custom Role creation,updation and deletion', async () => {
    const roleService = new RoleService({ auth0Domain: TEST_DOMAIN })
    const createdRole = await roleService.createRole(TEST_TENANT_ID, {
      name: 'test-name',
      description: 'test-description',
    })
    expect(createdRole).toEqual({
      id: 'test-id',
      name: 'test-name',
      description: 'test-description',
    })
    expect(TEST_ROLES.length).toEqual(3)
    await roleService.updateRole(TEST_TENANT_ID, 'test-id', {
      name: 'test-name-updated',
      description: 'test-description-updated',
    })
    expect(TEST_ROLES[2]).toEqual({
      id: 'test-id',
      name: 'test-tenant-id:test-name-updated',
      description: 'test-description-updated',
    })
    await roleService.deleteRole(TEST_TENANT_ID, 'test-id')
    expect(TEST_ROLES.length).toEqual(2)
  })
})
