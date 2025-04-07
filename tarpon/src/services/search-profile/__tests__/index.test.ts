import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import { SearchProfileService } from '..'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { CounterRepository } from '@/services/counter/repository'
import { SearchProfileRequest } from '@/@types/openapi-internal/SearchProfileRequest'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

// Mock storage for profiles
let mockProfiles: Array<{
  searchProfileId: string
  searchProfileName: string
  searchProfileDescription: string
  isDefault: boolean
  fuzziness: number
  types: string[]
  nationality: string[]
  createdAt: number
  updatedAt: number
  searchProfileStatus: string
}> = []

// Mock DynamoDB client and utils
jest.mock('@/utils/dynamodb', () => {
  const mockSend = jest.fn()
  const mockDynamoDb = {
    send: mockSend,
  }

  mockSend.mockImplementation(
    async (
      command:
        | PutCommand
        | ScanCommand
        | UpdateCommand
        | QueryCommand
        | DeleteCommand
    ) => {
      if (command instanceof PutCommand && command.input.Item) {
        const item = command.input.Item as (typeof mockProfiles)[0]
        // If this is a default profile, update existing default profiles
        if (item.isDefault) {
          mockProfiles.forEach((p) => {
            if (p.isDefault) {
              p.isDefault = false
              p.updatedAt = Date.now()
            }
          })
        }
        mockProfiles.push(item)
        return {}
      }
      if (command instanceof DeleteCommand) {
        const key = command.input.Key
        if (!key?.SortKeyID) {
          return {}
        }
        const index = mockProfiles.findIndex(
          (p) => p.searchProfileId === key.SortKeyID
        )
        if (index !== -1) {
          mockProfiles.splice(index, 1)
        }
        return {}
      }
      if (command instanceof ScanCommand) {
        if (command.input.FilterExpression?.includes('isDefault')) {
          return {
            Items: mockProfiles.filter((p) => p.isDefault === true),
          }
        }
        if (command.input.FilterExpression?.includes('searchProfileId =')) {
          const values = command.input.ExpressionAttributeValues || {}
          const ids = Object.values(values)
          return {
            Items: mockProfiles.filter((p) => ids.includes(p.searchProfileId)),
          }
        }
        return {
          Items: mockProfiles,
        }
      }
      if (command instanceof UpdateCommand) {
        const key = command.input.Key
        if (!key?.SortKeyID) {
          return {}
        }
        const index = mockProfiles.findIndex(
          (p) => p.searchProfileId === key.SortKeyID
        )
        if (index !== -1) {
          const updateExp = command.input.UpdateExpression
          const expValues = command.input.ExpressionAttributeValues

          if (updateExp && expValues) {
            // Parse update expression and apply updates
            updateExp
              .replace('SET ', '')
              .split(', ')
              .forEach((update) => {
                const [field, value] = update.split(' = ')
                const typedField = field as keyof (typeof mockProfiles)[0]
                const typedValue = expValues[
                  value
                ] as (typeof mockProfiles)[0][typeof typedField]
                // Use type assertion to bypass the type error
                ;(mockProfiles[index] as Record<string, unknown>)[typedField] =
                  typedValue
              })

            // If setting isDefault to true, update other profiles
            if (expValues[':isDefault'] === true) {
              mockProfiles.forEach((p, i) => {
                if (i !== index && p.isDefault) {
                  p.isDefault = false
                  p.updatedAt = Date.now()
                }
              })
            }
          }
        }
        return {
          Attributes: mockProfiles[index],
        }
      }
      if (command instanceof QueryCommand) {
        if (command.input.FilterExpression?.includes('isDefault')) {
          return {
            Items: mockProfiles.filter((p) => p.isDefault === true),
          }
        }
        if (command.input.FilterExpression?.includes('searchProfileId =')) {
          const values = command.input.ExpressionAttributeValues || {}
          const ids = Object.values(values)
          return {
            Items: mockProfiles.filter((p) => ids.includes(p.searchProfileId)),
          }
        }
        if (command.input.FilterExpression?.includes('searchProfileName =')) {
          const values = command.input.ExpressionAttributeValues || {}
          const names = Object.values(values)
          return {
            Items: mockProfiles.filter((p) =>
              names.includes(p.searchProfileName)
            ),
          }
        }
        // Return all profiles if no specific filter
        return {
          Items: mockProfiles,
        }
      }
      return {}
    }
  )

  return {
    getDynamoDbClient: () => mockDynamoDb,
  }
})

describe('Search Profile Service', () => {
  const TEST_TENANT_ID = getTestTenantId()
  let counterRepository: CounterRepository
  let service: SearchProfileService
  let dynamoDb: DynamoDBDocumentClient

  beforeEach(async () => {
    const mongoClient = await getMongoDbClient()
    counterRepository = new CounterRepository(TEST_TENANT_ID, mongoClient)
    service = new SearchProfileService(TEST_TENANT_ID, counterRepository)
    dynamoDb = getDynamoDbClient()
    mockProfiles = []
  })

  describe('Create Search Profile', () => {
    test('Create a new search profile', async () => {
      const request: SearchProfileRequest = {
        searchProfileName: 'Test Profile',
        searchProfileDescription: 'Test Description',
        isDefault: false,
        fuzziness: 0.5,
        types: ['SANCTIONS', 'PEP'],
        nationality: ['US', 'UK'],
        searchProfileStatus: 'ENABLED',
      }

      const response = await service.createSearchProfile(dynamoDb, request)
      expect(response.searchProfileName).toBe(request.searchProfileName)
      expect(response.searchProfileDescription).toBe(
        request.searchProfileDescription
      )
      expect(response.isDefault).toBe(request.isDefault)
      expect(response.fuzziness).toBe(request.fuzziness)
      expect(response.types).toEqual(request.types)
      expect(response.nationality).toEqual(request.nationality)
    })

    test('Create a default profile should update existing default profile', async () => {
      // Create first default profile
      const request1: SearchProfileRequest = {
        searchProfileName: 'Default Profile 1',
        searchProfileDescription: 'First Default Profile',
        isDefault: true,
        fuzziness: 0.5,
        types: ['SANCTIONS'],
        nationality: ['US'],
        searchProfileStatus: 'ENABLED',
      }

      await service.createSearchProfile(dynamoDb, request1)

      // Create second default profile
      const request2: SearchProfileRequest = {
        searchProfileName: 'Default Profile 2',
        searchProfileDescription: 'Second Default Profile',
        isDefault: true,
        fuzziness: 0.6,
        types: ['PEP'],
        nationality: ['UK'],
        searchProfileStatus: 'ENABLED',
      }

      const response2 = await service.createSearchProfile(dynamoDb, request2)
      expect(response2.isDefault).toBe(true)

      // Get all profiles and verify only one is default
      const profiles = await service.getSearchProfiles(dynamoDb)
      const defaultProfiles = profiles.items.filter((p) => p.isDefault)
      expect(defaultProfiles.length).toBe(1)
      expect(defaultProfiles[0].searchProfileId).toBe(response2.searchProfileId)
    })
  })

  describe('Update Search Profile', () => {
    test('Update a search profile', async () => {
      // First create a profile
      const createRequest: SearchProfileRequest = {
        searchProfileName: 'Original Profile',
        searchProfileDescription: 'Original Description',
        isDefault: false,
        fuzziness: 0.5,
        types: ['SANCTIONS'],
        nationality: ['US'],
        searchProfileStatus: 'ENABLED',
      }

      const createdProfile = await service.createSearchProfile(
        dynamoDb,
        createRequest
      )
      if (!createdProfile.searchProfileId) {
        throw new Error('Search profile ID is required')
      }

      // Then update it
      const updateRequest: SearchProfileRequest = {
        searchProfileName: 'Updated Profile',
        searchProfileDescription: 'Updated Description',
        isDefault: true,
        fuzziness: 0.6,
        types: ['PEP'],
        nationality: ['UK'],
        searchProfileStatus: 'ENABLED',
      }

      const updatedProfile = await service.updateSearchProfile(
        dynamoDb,
        createdProfile.searchProfileId,
        updateRequest
      )
      expect(updatedProfile.searchProfileName).toBe(
        updateRequest.searchProfileName
      )
      expect(updatedProfile.searchProfileDescription).toBe(
        updateRequest.searchProfileDescription
      )
      expect(updatedProfile.isDefault).toBe(updateRequest.isDefault)
      expect(updatedProfile.fuzziness).toBe(updateRequest.fuzziness)
      expect(updatedProfile.types).toEqual(updateRequest.types)
      expect(updatedProfile.nationality).toEqual(updateRequest.nationality)
    })

    test('Setting a profile as default should update existing default profile', async () => {
      // Create first default profile
      const request1: SearchProfileRequest = {
        searchProfileName: 'Default Profile 1',
        searchProfileDescription: 'First Default Profile',
        isDefault: true,
        fuzziness: 0.5,
        types: ['SANCTIONS'],
        nationality: ['US'],
        searchProfileStatus: 'ENABLED',
      }

      await service.createSearchProfile(dynamoDb, request1)

      // Create second non-default profile
      const request2: SearchProfileRequest = {
        searchProfileName: 'Non-Default Profile',
        searchProfileDescription: 'Non-Default Profile',
        isDefault: false,
        fuzziness: 0.6,
        types: ['PEP'],
        nationality: ['UK'],
        searchProfileStatus: 'ENABLED',
      }

      const response2 = await service.createSearchProfile(dynamoDb, request2)
      if (!response2.searchProfileId) {
        throw new Error('Search profile ID is required')
      }

      // Update second profile to be default
      const updateRequest: SearchProfileRequest = {
        ...request2,
        isDefault: true,
        searchProfileStatus: 'ENABLED',
      }

      await service.updateSearchProfile(
        dynamoDb,
        response2.searchProfileId,
        updateRequest
      )

      // Get all profiles and verify only one is default
      const profiles = await service.getSearchProfiles(dynamoDb)
      const defaultProfiles = profiles.items.filter((p) => p.isDefault)
      expect(defaultProfiles.length).toBe(1)
      expect(defaultProfiles[0].searchProfileId).toBe(response2.searchProfileId)
    })

    test('Partial update should only modify specified fields', async () => {
      // Create initial profile
      const createRequest: SearchProfileRequest = {
        searchProfileName: 'Original Profile',
        searchProfileDescription: 'Original Description',
        isDefault: false,
        fuzziness: 0.5,
        types: ['SANCTIONS'],
        nationality: ['US'],
        searchProfileStatus: 'ENABLED',
      }

      const createdProfile = await service.createSearchProfile(
        dynamoDb,
        createRequest
      )
      if (!createdProfile.searchProfileId) {
        throw new Error('Search profile ID is required')
      }

      // Partial update
      const updateRequest: SearchProfileRequest = {
        searchProfileName: 'Updated Name',
        isDefault: true,
        searchProfileStatus: 'ENABLED',
      }

      const updatedProfile = await service.updateSearchProfile(
        dynamoDb,
        createdProfile.searchProfileId,
        updateRequest
      )
      expect(updatedProfile.searchProfileName).toBe(
        updateRequest.searchProfileName
      )
      expect(updatedProfile.searchProfileDescription).toBe(
        createRequest.searchProfileDescription
      )
      expect(updatedProfile.isDefault).toBe(updateRequest.isDefault)
      expect(updatedProfile.fuzziness).toBe(createRequest.fuzziness)
      expect(updatedProfile.types).toEqual(createRequest.types)
      expect(updatedProfile.nationality).toEqual(createRequest.nationality)
    })
  })

  describe('Get Search Profiles', () => {
    test('Get all search profiles', async () => {
      // Create multiple profiles
      const request1: SearchProfileRequest = {
        searchProfileName: 'Profile 1',
        searchProfileDescription: 'Description 1',
        isDefault: true,
        fuzziness: 0.5,
        types: ['SANCTIONS'],
        nationality: ['US'],
        searchProfileStatus: 'ENABLED',
      }

      const request2: SearchProfileRequest = {
        searchProfileName: 'Profile 2',
        searchProfileDescription: 'Description 2',
        isDefault: false,
        fuzziness: 0.6,
        types: ['PEP'],
        nationality: ['UK'],
        searchProfileStatus: 'ENABLED',
      }

      await service.createSearchProfile(dynamoDb, request1)
      await service.createSearchProfile(dynamoDb, request2)

      const profiles = await service.getSearchProfiles(dynamoDb)
      expect(profiles.items.length).toBe(2)
      expect(profiles.total).toBe(2)
    })

    test('Get specific search profiles by ID', async () => {
      // Create a profile
      const request: SearchProfileRequest = {
        searchProfileName: 'Test Profile',
        searchProfileDescription: 'Test Description',
        isDefault: false,
        fuzziness: 0.5,
        types: ['SANCTIONS'],
        nationality: ['US'],
        searchProfileStatus: 'ENABLED',
      }

      const createdProfile = await service.createSearchProfile(
        dynamoDb,
        request
      )
      if (!createdProfile.searchProfileId) {
        throw new Error('Search profile ID is required')
      }

      // Get the profile by ID
      const profiles = await service.getSearchProfiles(dynamoDb, [
        createdProfile.searchProfileId,
      ])
      expect(profiles.items.length).toBe(1)
      expect(profiles.items[0].searchProfileId).toBe(
        createdProfile.searchProfileId
      )
      expect(profiles.total).toBe(1)
    })

    test('Get specific search profiles by name', async () => {
      // Create profiles with different names
      const request1: SearchProfileRequest = {
        searchProfileName: 'Test Profile 35',
        searchProfileDescription: 'Test Description',
        isDefault: false,
        fuzziness: 0.5,
        types: ['SANCTIONS'],
        nationality: ['US'],
        searchProfileStatus: 'ENABLED',
      }

      const request2: SearchProfileRequest = {
        searchProfileName: 'Test Profile 34',
        searchProfileDescription: 'Test Description',
        isDefault: false,
        fuzziness: 0.6,
        types: ['PEP'],
        nationality: ['UK'],
        searchProfileStatus: 'ENABLED',
      }

      await service.createSearchProfile(dynamoDb, request1)
      await service.createSearchProfile(dynamoDb, request2)

      // Get profiles by name
      const profiles = await service.getSearchProfiles(dynamoDb, undefined, [
        'Test Profile 35',
      ])
      expect(profiles.items.length).toBe(1)
      expect(profiles.items[0].searchProfileName).toBe('Test Profile 35')
      expect(profiles.total).toBe(1)
    })

    test('Get specific search profiles by both ID and name', async () => {
      // Create profiles
      const request1: SearchProfileRequest = {
        searchProfileName: 'Test Profile 35',
        searchProfileDescription: 'Test Description',
        isDefault: false,
        fuzziness: 0.5,
        types: ['SANCTIONS'],
        nationality: ['US'],
        searchProfileStatus: 'ENABLED',
      }

      const request2: SearchProfileRequest = {
        searchProfileName: 'Test Profile 34',
        searchProfileDescription: 'Test Description',
        isDefault: false,
        fuzziness: 0.6,
        types: ['PEP'],
        nationality: ['UK'],
        searchProfileStatus: 'ENABLED',
      }

      const profile1 = await service.createSearchProfile(dynamoDb, request1)
      if (!profile1.searchProfileId) {
        throw new Error('Search profile ID is required')
      }
      await service.createSearchProfile(dynamoDb, request2)

      // Get profiles by both ID and name
      const profiles = await service.getSearchProfiles(
        dynamoDb,
        [profile1.searchProfileId],
        ['Test Profile 35']
      )
      expect(profiles.items.length).toBe(1)
      expect(profiles.items[0].searchProfileId).toBe(profile1.searchProfileId)
      expect(profiles.items[0].searchProfileName).toBe('Test Profile 35')
      expect(profiles.total).toBe(1)
    })
  })

  describe('Delete Search Profile', () => {
    test('Delete an existing search profile', async () => {
      // Create a profile
      const request: SearchProfileRequest = {
        searchProfileName: 'Test Profile',
        searchProfileDescription: 'Test Description',
        isDefault: false,
        fuzziness: 0.5,
        types: ['SANCTIONS'],
        nationality: ['US'],
        searchProfileStatus: 'ENABLED',
      }

      const createdProfile = await service.createSearchProfile(
        dynamoDb,
        request
      )
      if (!createdProfile.searchProfileId) {
        throw new Error('Search profile ID is required')
      }

      // Delete the profile
      await service.deleteSearchProfile(
        dynamoDb,
        createdProfile.searchProfileId
      )

      // Verify the profile is deleted
      const profiles = await service.getSearchProfiles(dynamoDb, [
        createdProfile.searchProfileId,
      ])
      expect(profiles.items.length).toBe(0)
    })

    test('Delete a non-existent search profile should throw error', async () => {
      // Try to delete a non-existent profile
      await expect(
        service.deleteSearchProfile(dynamoDb, 'SP-999')
      ).rejects.toThrow('Search profile not found')
    })
  })
})
