import { JSONSchemaType } from 'ajv'

import _ from 'lodash'
import { UserRuleFilter } from './filter'
import { uiSchema } from '@/services/rules-engine/utils/rule-schema-utils'
import { ListRepository } from '@/lambdas/console-api-list-importer/repositories/list-repository'
import { logger } from '@/core/logger'

export type WhitelistUsersRuleFilterParameter = {
  whitelistUsers?: {
    listIds?: string[]
    userIds?: string[]
  }
}

export class WhitelistUsersRuleFilter extends UserRuleFilter<WhitelistUsersRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<WhitelistUsersRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        whitelistUsers: {
          type: 'object',
          title: 'Whitelist users',
          description:
            'Add user IDs or Whitelist IDs to exclude users from this rule when run',
          properties: {
            listIds: {
              type: 'array',
              title: 'Whitelist IDs',
              items: { type: 'string' },
              uniqueItems: true,
              nullable: true,
            },
            userIds: {
              type: 'array',
              title: 'User IDs',
              items: { type: 'string' },
              uniqueItems: true,
              nullable: true,
            },
          },
          required: [],
          nullable: true,
          ...uiSchema({ group: 'user' }),
        },
      },
    }
  }

  public async predicate(): Promise<boolean> {
    const { listIds, userIds } = this.parameters.whitelistUsers!
    const inputUserIds = [this.user.userId]
    if (userIds && _.intersection(inputUserIds, userIds).length > 0) {
      return false
    }
    if (listIds) {
      const listRepo = new ListRepository(this.tenantId, this.dynamoDb)
      const result = await Promise.all(
        listIds.flatMap((listId) =>
          inputUserIds.map(async (userId) => ({
            listId,
            userId,
            match: await listRepo.match(listId, userId, 'EXACT'),
          }))
        )
      )
      const match = result.find((item) => item.match)
      if (match) {
        logger.info(`Found user ${match.userId} in list ${match.listId}`)
        return false
      }
    }
    return true
  }
}
