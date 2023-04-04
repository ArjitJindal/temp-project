import { Db, MongoClient } from 'mongodb'
import { createMongoDBCollections } from '@/utils/mongoDBUtils'
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
  const re = new RegExp(inputTenantId + `-((?!test).+)`)
  const allMongoDbCollections = await inputDB
    .listCollections({
      name: re,
    })
    .toArray()
  await createMongoDBCollections(client, outputTenantId)
  for (const collection of allMongoDbCollections) {
    const inputCollectionName = collection.name
    const outputCollectionName = collection.name.replace(
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

    let output = []
    for await (const document of collectionData) {
      if (!document) continue

      if (mappingFn) {
        const collectionName = inputCollectionName.replace(
          `${inputTenantId}-`,
          ''
        )
        output.push(mappingFn(collectionName, document))
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
