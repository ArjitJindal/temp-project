import { Db, MongoClient } from 'mongodb'
import { allCollections, createMongoDBCollections } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'

const BATCH_SIZE = 1000
export async function copyCollections(
  client: MongoClient,
  inputTenantId: string,
  inputDB: Db,
  outputTenantId: string,
  outputDB: Db,
  mappingFn?: (collection: string, document: any) => any
) {
  logger.info(`Copy collection from ${inputTenantId} to ${outputTenantId}`)
  const allMongoDbCollections = allCollections(inputTenantId, inputDB)
  await createMongoDBCollections(client, outputTenantId)
  for (const collection in allMongoDbCollections) {
    const inputCollectionName = collection
    const outputCollectionName = collection.replace(
      inputTenantId,
      outputTenantId
    )
    logger.info(`Copying ${inputCollectionName} to ${outputCollectionName}`)
    const collectionData = await inputDB.collection(inputCollectionName).find()

    const count = await inputDB.collection(inputCollectionName).countDocuments()

    if (count == 0) {
      continue
    }

    if (
      (await outputDB
        .collection(outputCollectionName)
        .estimatedDocumentCount()) > 0
    ) {
      await outputDB.collection(outputCollectionName).drop()
    }

    let output: any[] = []
    for await (const document of collectionData) {
      if (!document) {
        continue
      }

      if (mappingFn) {
        const collectionName = inputCollectionName.replace(
          `${inputTenantId}-`,
          ''
        )
        output.push(await mappingFn(collectionName, document))
      } else {
        output.push(document)
      }

      if (output.length == BATCH_SIZE) {
        await outputDB.collection(outputCollectionName).insertMany(output)
        output = []
      }
    }

    // Process the final batch
    if (output.length > 0) {
      await outputDB.collection(outputCollectionName).insertMany(output)
      output = []
    }
  }
}
