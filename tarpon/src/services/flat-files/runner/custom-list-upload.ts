import { v4 as uuidv4 } from 'uuid'
import { FlatFileRunner } from './index'
import { FlatFilesRecordsSchema } from '@/@types/flat-files'
import { EntityModel } from '@/@types/model'
import { CustomListMetadataList } from '@/@types/openapi-internal/CustomListMetadataList'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { logger } from '@/core/logger'

export class CustomListUploadRunner extends FlatFileRunner<{
  [key: string]: string
}> {
  public async validate(
    _data: { [key: string]: string },
    _metadata: CustomListMetadataList
  ) {
    return {
      valid: true,
      errors: [],
    }
  }

  model = (metadata: CustomListMetadataList) => {
    const attributes = metadata.items.map((metadata) => ({
      name: metadata.key,
      baseName: metadata.key,
      type: metadata.type,
      format: metadata.type === 'DATE' ? 'date-time' : '',
    }))

    class CustomListUpload extends EntityModel {
      static readonly attributeTypeMap = attributes
    }

    return CustomListUpload
  }

  public concurrency = 10

  public async _run(
    data: { [key: string]: string },
    record: FlatFilesRecordsSchema,
    metadata: CustomListMetadataList
  ) {
    const { listId } = metadata
    const listRepository = new ListRepository(this.tenantId, this.dynamoDb)

    try {
      await listRepository.setListItems(listId, [
        {
          key: uuidv4(),
          metadata: {
            ...data,
          },
        },
      ])
    } catch (error) {
      logger.error(`Failed to set list items ${listId}`, {
        error,
        listId,
      })
      await this.updateRecordStatus(record, true, [
        {
          keyword: error instanceof Error ? error.name : 'unknown',
          message: error instanceof Error ? error.message : 'unknown',
          stage: 'RUNNER',
          params: error instanceof Error ? error.stack : undefined,
        },
      ])
    }
  }
}
