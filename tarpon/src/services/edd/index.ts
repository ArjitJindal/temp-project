import { MongoClient } from 'mongodb'
import { EddRepository } from './repository'
import { EDDReview } from '@/@types/openapi-internal/EDDReview'
import { traceable } from '@/core/xray'
import { EDDReviewResponse } from '@/@types/openapi-internal/EDDReviewResponse'

@traceable
export class EddService {
  eddRepository: EddRepository

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.eddRepository = new EddRepository(tenantId, mongoDb)
  }

  async getEddReviews(userId: string): Promise<EDDReviewResponse> {
    return await this.eddRepository.getEddReviews(userId)
  }

  async getEddReview(
    userId: string,
    eddReviewId: string
  ): Promise<EDDReview | null> {
    return await this.eddRepository.getEddReview(userId, eddReviewId)
  }

  async updateEddReview(
    userId: string,
    eddReviewId: string,
    review: string
  ): Promise<EDDReview | null> {
    return await this.eddRepository.updateEddReview(userId, eddReviewId, review)
  }

  async createEddReview(eddReview: EDDReview) {
    return await this.eddRepository.createEddReview(eddReview)
  }
}
