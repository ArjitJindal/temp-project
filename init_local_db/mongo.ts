#!/usr/bin/env ts-node
import { MongoClient } from 'mongodb'

import transactions from './mongo_transactions'
import users from './mongo_users'
import transactionEvents from './mongo_events'
import { DB_NAME, TENANT } from './settings'

const collections = [
  [`${TENANT}-transactions`, transactions],
  [`${TENANT}-users`, users],
  [`${TENANT}-transaction-events`, transactionEvents],
]

async function main() {
  const client = await MongoClient.connect(`mongodb://localhost/${DB_NAME}`)
  const db = await client.db()
  for (const [collectionName, data] of collections) {
    console.log(`Re-create collection: ${collectionName}`)
    const collection = db.collection(collectionName as string)
    try {
      await collection.drop()
    } catch (e) {
      // ignore
    }
    await collection.insertMany(data as any)
  }
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
