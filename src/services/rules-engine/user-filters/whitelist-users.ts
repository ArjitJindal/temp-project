import { JSONSchemaType } from 'ajv'

import _ from 'lodash'
import { UserRuleFilter } from './filter'
import { ListRepository } from '@/lambdas/console-api-list-importer/repositories/list-repository'
import { logger } from '@/core/logger'

export type WhitelistUsersRuleFilterParameter = {
  whitelistUsers?: {
    listIds?: string[]
    userIds?: string[]
  }
}

export default class WhitelistUsersRuleFilter extends UserRuleFilter<WhitelistUsersRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<WhitelistUsersRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        whitelistUsers: {
          type: 'object',
          title: 'Whitelist Users',
          properties: {
            listIds: {
              type: 'array',
              title: 'Whitelist List IDs',
              items: { type: 'string' },
              nullable: true,
            },
            userIds: {
              type: 'array',
              title: 'Whitelist User IDs',
              items: { type: 'string' },
              nullable: true,
            },
          },
          required: [],
          nullable: true,
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
