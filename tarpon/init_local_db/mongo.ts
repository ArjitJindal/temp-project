#!/usr/bin/env ts-node
import { MongoClient } from 'mongodb'
import { DB_NAME, TENANT } from './settings'
import { seedMongo } from '@/core/seed/mongo'

async function main() {
  const client = await MongoClient.connect(
    `mongodb://localhost:27018/${DB_NAME}`
  )
  await seedMongo(client, TENANT)
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
