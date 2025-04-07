import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { AccountsService } from '@/services/accounts'
import { Account } from '@/@types/openapi-internal/Account'
import { TenantService } from '@/services/tenants'

const COMMENT_PREFIX = 'Checker Comment:'

const getCommentPrefix = (
  account: Account | undefined,
  hasMultiLevelEscalation: boolean
) => {
  let commentPrefix = ''
  if (account?.reviewerId) {
    commentPrefix = 'Maker Comment:'
  } else if (account?.isReviewer) {
    commentPrefix = 'Checker Comment:'
  } else if (hasMultiLevelEscalation) {
    if (account?.escalationLevel === 'L1') {
      commentPrefix = 'Escalation Reveiwer L1 Comment:'
    } else if (account?.escalationLevel === 'L2') {
      commentPrefix = 'Escalation Reveiwer L2 Comment:'
    }
  }
  if (!commentPrefix) {
    commentPrefix = 'User Comment:'
  }
  return commentPrefix
}

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const accountsService = new AccountsService({ auth0Domain }, { dynamoDb })
  const accounts: { [accountId: string]: Account } = (
    await accountsService.getTenantAccounts(tenant)
  ).reduce((acc, account) => {
    acc[account.id] = account
    return acc
  }, {})

  const tenantService = new TenantService(tenant.id, { dynamoDb, mongoDb })

  const hasMultiLevelEscalation =
    (await tenantService.getTenantSettings()).features?.includes(
      'MULTI_LEVEL_ESCALATION'
    ) ?? false

  const db = mongoDb.db()
  const collection = db.collection<Case>(CASES_COLLECTION(tenant.id))

  const caseCursor = collection.find()

  await processCursorInBatch(
    caseCursor,
    async (cases) => {
      const updates: {
        updateOne: {
          filter: { caseId: string }
          update: { $set: object }
          arrayFilters: { [commentId: string]: string }[]
        }
      }[] = []

      let filterCounter = 0
      cases.forEach((case_) => {
        if (case_ && case_.caseId) {
          const commentUpdate = {}
          const arrayFilters: { [commentId: string]: string }[] = []

          case_.comments?.forEach((comment) => {
            if (
              comment.id &&
              comment.type === 'STATUS_CHANGE' &&
              comment.body.includes(COMMENT_PREFIX)
            ) {
              const newCommentPrefix = getCommentPrefix(
                accounts[comment.userId ?? ''],
                hasMultiLevelEscalation
              )
              const newCommentBody = comment.body.replace(
                COMMENT_PREFIX,
                newCommentPrefix
              )

              const filterVar = `c${filterCounter++}`
              commentUpdate[`comments.$[${filterVar}].body`] = newCommentBody
              arrayFilters.push({ [`${filterVar}.id`]: comment.id })
            }
          })

          case_.alerts?.forEach((alert) => {
            if (alert.alertId) {
              const alertVar = `a${filterCounter++}`
              let used = false

              alert.comments?.forEach((comment) => {
                if (
                  comment.type === 'STATUS_CHANGE' &&
                  comment.id &&
                  comment.body.includes(COMMENT_PREFIX)
                ) {
                  const newCommentPrefix = getCommentPrefix(
                    accounts[comment.userId ?? ''],
                    hasMultiLevelEscalation
                  )
                  const newCommentBody = comment.body.replace(
                    COMMENT_PREFIX,
                    newCommentPrefix
                  )

                  const commentVar = `c${filterCounter++}`

                  commentUpdate[
                    `alerts.$[${alertVar}].comments.$[${commentVar}].body`
                  ] = newCommentBody

                  arrayFilters.push({ [`${commentVar}.id`]: comment.id })
                  used = true
                }
              })

              if (used) {
                arrayFilters.push({ [`${alertVar}.alertId`]: alert.alertId })
              }
            }
          })

          if (arrayFilters.length > 0) {
            updates.push({
              updateOne: {
                filter: { caseId: case_.caseId },
                update: { $set: commentUpdate },
                arrayFilters,
              },
            })
          }
        }
      })
      if (updates.length > 0) {
        await collection.bulkWrite(updates)
      }
    },
    {
      mongoBatchSize: 1000,
      processBatchSize: 500,
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
