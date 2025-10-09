import { MongoClient } from 'mongodb'

import { EDD_REVIEWS_COLLECTION } from '@/utils/mongo-table-names'
import { EDDReview } from '@/@types/openapi-internal/EDDReview'
import { traceable } from '@/core/xray'
import { EDDReviewResponse } from '@/@types/openapi-internal/EDDReviewResponse'

@traceable
export class EddRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  async getEddReviews(userId: string): Promise<EDDReviewResponse> {
    const reviews = await this.mongoDb
      .db()
      .collection<EDDReview>(EDD_REVIEWS_COLLECTION(this.tenantId))
      .find({ userId })
      .project({ review: 0 })
      .toArray()

    return {
      data: reviews as EDDReview[],
      total: reviews.length,
    }
  }

  async getEddReview(
    userId: string,
    eddReviewId: string
  ): Promise<EDDReview | null> {
    return (
      (await this.mongoDb
        .db()
        .collection<EDDReview>(EDD_REVIEWS_COLLECTION(this.tenantId))
        .findOne({ userId, id: eddReviewId })) || null
    )
  }

  async updateEddReview(
    userId: string,
    eddReviewId: string,
    review: string
  ): Promise<EDDReview | null> {
    await this.mongoDb
      .db()
      .collection<EDDReview>(EDD_REVIEWS_COLLECTION(this.tenantId))
      .updateOne({ userId, id: eddReviewId }, { $set: { review } })

    return await this.getEddReview(userId, eddReviewId)
  }

  async createEddReview(eddReview: EDDReview): Promise<void> {
    await this.mongoDb
      .db()
      .collection(EDD_REVIEWS_COLLECTION(this.tenantId))
      .insertOne(eddReview)
  }
}
