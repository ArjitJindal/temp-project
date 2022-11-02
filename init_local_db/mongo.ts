#!/usr/bin/env ts-node
import { MongoClient } from 'mongodb'

import transactions from './data/transactions'
import users from './data/users'
import cases from './data/cases'
import transactionEvents from './data/transaction_events'
import { DB_NAME, TENANT } from './settings'

const collections = [
  [`${TENANT}-transactions`, transactions],
  [`${TENANT}-cases`, cases],
  [`${TENANT}-users`, users],
  [`${TENANT}-transaction-events`, transactionEvents],
]

async function main() {
  const client = await MongoClient.connect(
    `mongodb://localhost:27018/${DB_NAME}`
  )
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
