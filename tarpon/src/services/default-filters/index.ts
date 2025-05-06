import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DefaultFiltersRepository } from './repositories/default-filters-repository'
import { DefaultManualScreeningFiltersRequest } from '@/@types/openapi-internal/DefaultManualScreeningFiltersRequest'
import { DefaultManualScreeningFiltersResponse } from '@/@types/openapi-internal/DefaultManualScreeningFiltersResponse'
import { traceable } from '@/core/xray'

@traceable
export class DefaultFiltersService {
  private defaultFiltersRepository: DefaultFiltersRepository

  constructor(tenantId: string) {
    this.defaultFiltersRepository = new DefaultFiltersRepository(tenantId)
  }

  public async createDefaultFilters(
    filters: DefaultManualScreeningFiltersRequest,
    dynamoDb: DynamoDBClient
  ): Promise<DefaultManualScreeningFiltersResponse> {
    // Always replace the existing entry
    return this.defaultFiltersRepository.createDefaultFilters(filters, dynamoDb)
  }

  public async getDefaultFilters(
    dynamoDb: DynamoDBClient
  ): Promise<DefaultManualScreeningFiltersResponse | null> {
    return this.defaultFiltersRepository.getDefaultFilters(dynamoDb)
  }
}
