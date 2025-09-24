import isEmpty from 'lodash/isEmpty'
import { Case } from '@/@types/openapi-internal/Case'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'
import { ListItem } from '@/@types/openapi-internal/ListItem'
import { UserService } from '@/services/users'
import { ListService } from '@/services/list'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'

export interface UserData {
  caseId: string
  user: User | Business
}

export interface UpdateUserDetailsOptions {
  tenantId: string
  mongoDb: any
  dynamoDb: any
  cases: Case[]
  updates: { listId?: string }
  getUserUpdateRequest: (
    updates: any,
    userInDb?: InternalUser
  ) => UserUpdateRequest
}

/**
 * Common utility function to update user details and list items
 * Used by both alerts and cases services to avoid code duplication
 */
export async function updateUserDetails({
  tenantId,
  mongoDb,
  dynamoDb,
  cases,
  updates,
  getUserUpdateRequest,
}: UpdateUserDetailsOptions): Promise<void> {
  const usersData: UserData[] = []
  const listId = updates.listId

  // Extract users from cases
  cases.forEach((c) => {
    const user = c?.caseUsers?.origin ?? c?.caseUsers?.destination
    if (user && user.userId) {
      usersData.push({
        caseId: c.caseId ?? '',
        user: user as User | Business,
      })
    }
  })

  if (isEmpty(usersData)) {
    return
  }

  const userService = new UserService(tenantId, {
    mongoDb,
    dynamoDb,
  })

  const listService = new ListService(tenantId, {
    mongoDb,
    dynamoDb,
  })

  // Get user update object
  const userInDb = await userService.getUser(usersData[0].user.userId, false)
  const updateObject: UserUpdateRequest = getUserUpdateRequest(
    updates,
    userInDb
  )

  // Update users if there are updates to apply
  if (!isEmpty(updateObject)) {
    await Promise.all(
      usersData.map(({ user, caseId }) =>
        userService.updateUser(user, updateObject, {}, { caseId })
      )
    )
  }

  // Update list items if listId is provided
  if (listId) {
    await Promise.all(
      usersData.map(({ user }) => {
        const userFullName = extractUserFullName(user)
        const listItem: ListItem = {
          key: user.userId,
          metadata: {
            reason: '',
            userFullName,
          },
        }
        return listService.updateOrCreateListItem(listId, listItem)
      })
    )
  }
}

/**
 * Extracts the full name from a user or business entity
 */
export function extractUserFullName(user: User | Business): string {
  // Handle individual user with userDetails
  if ('userDetails' in user && user.userDetails?.name) {
    const {
      firstName = '',
      middleName = '',
      lastName = '',
    } = user.userDetails.name
    return [lastName, firstName, middleName].filter(Boolean).join(' ') || ''
  }

  // Handle business entity
  if ('legalEntity' in user && Array.isArray(user.legalEntity)) {
    return user.legalEntity?.companyGeneralDetails?.legalName || ''
  }

  return ''
}
