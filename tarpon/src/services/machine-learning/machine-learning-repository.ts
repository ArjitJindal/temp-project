import { Filter } from 'mongodb'
import { DefaultApiGetRuleMlModelsRequest } from '@/@types/openapi-internal/RequestParameters'
import { RuleMLModel } from '@/@types/openapi-internal/RuleMLModel'
import { ML_MODELS_COLLECTION } from '@/utils/mongo-table-names'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'

export class MachineLearningRepository {
  public async getAllMLModels(
    params: DefaultApiGetRuleMlModelsRequest
  ): Promise<RuleMLModel[]> {
    const db = await getMongoDbClientDb()
    const filter = this.getConditionsFromParams(params)
    const models = (await db
      .collection<RuleMLModel>(ML_MODELS_COLLECTION())
      .aggregate([
        {
          $match: filter,
        },
      ])
      .toArray()) as RuleMLModel[]
    return models
  }
  private getConditionsFromParams(params: DefaultApiGetRuleMlModelsRequest) {
    const conditions: Filter<RuleMLModel> = []
    if (params.modelId) {
      conditions.push({
        id: {
          $regex: `^${params.modelId}`,
        },
      })
    }
    if (params.modelType) {
      conditions.push({
        modelType: params.modelType,
      })
    }
    if (params.modelName) {
      conditions.push({
        name: {
          $regex: params.modelName,
          $options: 'i',
        },
      })
    }
    return conditions.length
      ? {
          $and: conditions,
        }
      : {}
  }

  public async updateMLModel(
    modelId: string,
    model: RuleMLModel
  ): Promise<RuleMLModel> {
    const db = await getMongoDbClientDb()
    await db.collection<RuleMLModel>(ML_MODELS_COLLECTION()).updateOne(
      {
        id: modelId,
      },
      {
        $set: model,
      }
    )
    return model
  }
}
