import { JSONSchemaType } from 'ajv'

import intersection from 'lodash/intersection'
import { UserRuleFilter } from './filter'
import { uiSchema } from '@/services/rules-engine/utils/rule-schema-utils'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'

export type WhitelistUsersRuleFilterParameter = {
  whitelistUsers?: {
    listIds?: string[]
    userIds?: string[]
  }
}

@traceable
export class WhitelistUsersRuleFilter extends UserRuleFilter<WhitelistUsersRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<WhitelistUsersRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        whitelistUsers: {
          type: 'object',
          title: 'Whitelist {{userAlias}}s',
          description:
            'Add {{userAlias}} IDs or Whitelist IDs to exclude {{userAlias}}s from this rule when run',
          properties: {
            listIds: {
              type: 'array',
              title: 'Whitelist IDs',
              items: { type: 'string' },
              uniqueItems: true,
              nullable: true,
              ...uiSchema({
                subtype: 'WHITELIST',
              }),
            },
            userIds: {
              type: 'array',
              title: '{{UserAlias}} IDs',
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
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }
    const { listIds, userIds } = this.parameters.whitelistUsers ?? {}
    const inputUserIds = [this.user.userId]
    if (userIds && intersection(inputUserIds, userIds).length > 0) {
      return false
    }
    if (listIds) {
      const listRepo = new ListRepository(this.tenantId, this.dynamoDb)
      const result = await Promise.all(
        listIds.map(async (listId) => {
          const listHeader = await listRepo.getListHeader(listId)
          if (!listHeader?.metadata?.status) {
            return inputUserIds.map((userId) => ({
              listId,
              userId,
              match: false,
            }))
          }
          return Promise.all(
            inputUserIds.map(async (userId) => ({
              listId,
              userId,
              match: await listRepo.match(listHeader, userId, 'EXACT'),
            }))
          )
        })
      ).then((results) => results.flat())
      const match = result.find((item) => item.match)
      if (match) {
        logger.debug(`Found user ${match.userId} in list ${match.listId}`)
        return false
      }
    }
    return true
  }
}
