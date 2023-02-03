import * as fs from 'fs'
import fetch from 'node-fetch'
import { loadConfigEnv } from './migrations/utils/config'
import { getSecret } from '@/utils/secrets-manager'

loadConfigEnv()

const getPostmanCollection = async () => {
  const postmansecret: { apiKey: string } = await getSecret(
    process.env.POSTMAN_SECRET_ARN as string
  )

  const postmanCollection = await fetch(
    `https://api.getpostman.com/collections/${process.env.POSTMAN_COLLECTION_ID}`,
    {
      method: 'GET',
      headers: {
        'X-Api-Key': postmansecret.apiKey,
      },
    }
  )

  const postmanCollectionJson = await postmanCollection.json()

  delete postmanCollectionJson.collection.event
  delete postmanCollectionJson.collection.variable

  fs.writeFileSync(
    './test-resources/public-api-transactions-tests.postman_collection.json',
    JSON.stringify(postmanCollectionJson.collection, null, 2)
  )
}

getPostmanCollection()
