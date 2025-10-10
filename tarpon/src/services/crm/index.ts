import { Engagement, Note, Task } from '@mergeapi/merge-sdk-typescript/dist/crm'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ClickHouseClient } from '@clickhouse/client'
import { CrmAccountResponse } from '@/@types/openapi-internal/CrmAccountResponse'
import { traceable } from '@/core/xray'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  CRM_ENGAGEMENTS_COLLECTION,
  CRM_NOTES_COLLECTION,
  CRM_SUMMARY_COLLECTION,
  CRM_TASKS_COLLECTION,
} from '@/utils/mongo-table-names'
import { CrmSummary } from '@/@types/openapi-internal/CrmSummary'
import { CrmAccountResponseEngagements } from '@/@types/openapi-internal/CrmAccountResponseEngagements'
import { CrmAccountResponseNotes } from '@/@types/openapi-internal/CrmAccountResponseNotes'
import { CrmAccountResponseTasks } from '@/@types/openapi-internal/CrmAccountResponseTasks'

@traceable
export class CrmService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  clickHouseClient: ClickHouseClient

  constructor(
    tenantId: string,
    dynamoDb?: DynamoDBDocumentClient,
    clickHouseClient?: ClickHouseClient
  ) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb as DynamoDBDocumentClient
    this.clickHouseClient = clickHouseClient as ClickHouseClient
  }

  public async getAccount(id: string): Promise<CrmAccountResponse | null> {
    const client = await getMongoDbClient()
    const db = client.db()
    const [engagementCollection, notesCollection, tasksCollection] =
      await Promise.all([
        db
          .collection<Engagement>(CRM_ENGAGEMENTS_COLLECTION(this.tenantId))
          .find({
            account: id,
          })
          .toArray(),
        db
          .collection<Note>(CRM_NOTES_COLLECTION(this.tenantId))
          .find({
            account: id,
          })
          .toArray(),
        db
          .collection<Task>(CRM_TASKS_COLLECTION(this.tenantId))
          .find({
            account: id,
          })
          .toArray(),
      ])

    const engagements = engagementCollection.map(
      (engagement): CrmAccountResponseEngagements => {
        return {
          user: engagement.owner?.toString() || '',
          content: engagement.content ?? '',
          subject: engagement.subject?.toString() || '',
          createdAt: engagement.end_time?.getTime(),
          to: engagement.contacts as string[],
        }
      }
    )

    const notes = notesCollection.map(
      (n): CrmAccountResponseNotes => ({
        user: n.owner?.toString() || '',
        body: n.content || '',
        createdAt: n.remote_created_at?.getTime() || 0,
      })
    )

    const tasks = tasksCollection.map(
      (t): CrmAccountResponseTasks => ({
        user: t.owner?.toString() || '',
        content: t.content || '',
        createdAt: t.completed_date?.getTime(),
      })
    )
    const summary = await db
      .collection<CrmSummary>(CRM_SUMMARY_COLLECTION(this.tenantId))
      .findOne({
        accountId: id,
      })

    if (!summary) {
      return null
    }

    return { engagements, notes, tasks, summary }
  }
}
