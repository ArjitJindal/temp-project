import { v4 as uuidv4 } from 'uuid'
import { FlatFileRunner } from './index'
import { FlatFilesRecordsSchema } from '@/@types/flat-files'
import { EntityModel } from '@/@types/model'
import { CustomListMetadataList } from '@/@types/openapi-internal/CustomListMetadataList'
import { ListRepository } from '@/services/list/repositories/list-repository'

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
    _data: { [key: string]: string },
    _record: FlatFilesRecordsSchema,
    _metadata: CustomListMetadataList
  ) {
    const { listId } = _metadata
    const listRepository = new ListRepository(this.tenantId, this.dynamoDb)

    await listRepository.setListItems(listId, [
      {
        key: uuidv4(),
        metadata: {
          ..._data,
        },
      },
    ])
  }
}
