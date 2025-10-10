import { MongoClient } from 'mongodb'
import { Investigation, Variables } from './types'
import { INVESTIGATION_COLLECTION } from '@/utils/mongo-table-names'
import { QuestionResponse } from '@/@types/openapi-internal/QuestionResponse'
import { traceable } from '@/core/xray'

@traceable
export class InvestigationRepository {
  private readonly mongoClient: MongoClient
  private readonly tenantId: string

  constructor(mongoClient: MongoClient, tenantId: string) {
    this.mongoClient = mongoClient
    this.tenantId = tenantId
  }

  public async addQuestion(
    questionResponse: QuestionResponse,
    alertId: string,
    variables: Variables
  ) {
    const { questionId, createdById, createdAt } = questionResponse
    const db = this.mongoClient.db()
    const collection = db.collection<Investigation>(
      INVESTIGATION_COLLECTION(this.tenantId)
    )
    await collection.findOneAndUpdate(
      {
        alertId,
      },
      [
        {
          $set: {
            alertId,
            questions: {
              $concatArrays: [
                {
                  $filter: {
                    input: { $ifNull: ['$questions', []] },
                    cond: { $ne: ['$$this.questionId', questionId] },
                  },
                },
                [
                  {
                    questionId,
                    variables,
                    createdById,
                    createdAt,
                  },
                ],
              ],
            },
          },
        },
      ],
      { upsert: true }
    )
  }

  public async getInvestigation(alertId: string): Promise<Investigation> {
    const db = this.mongoClient.db()
    const collection = db.collection<Investigation>(
      INVESTIGATION_COLLECTION(this.tenantId)
    )
    const insert = {
      alertId,
      questions: [],
    }
    const investigation = await collection.findOneAndUpdate(
      {
        alertId,
      },
      {
        $setOnInsert: insert,
      },
      {
        upsert: true,
      }
    )
    if (!investigation.value) {
      return insert
    }
    return investigation.value
  }
}
