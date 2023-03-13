// Example usage:
// ts-node verify-remote-transactions --api https://eu-1.api.flagright.com --jwt <get_jwt_from_console>

// import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import fetch from 'node-fetch'
import _ from 'lodash'
import fs from 'fs-extra'

const configPath = path.join(__dirname, 'config.json')
const { api, jwt, transactionIds } = fs.readJSONSync(configPath, 'utf-8')
console.info(`Using config from "${configPath}"`)
console.info(`Will get ${transactionIds.length} transactions from "${api}"`)

const createdUsers = new Set<string>()

async function getRemoteTransaction(transactionId: string) {
  return (
    await fetch(`${api}/console/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })
  ).json()
}

async function getRemoteUser(userId: string) {
  const result = await (
    await Promise.race([
      fetch(`${api}/console/business/users/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }),
      fetch(`${api}/console/consumer/users/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }),
    ])
  ).json()
  if (result.error) {
    return null
  }
  return result
}

async function createUserLocally(userId: string) {
  if (createdUsers.has(userId)) {
    return
  }
  const user = await getRemoteUser(userId)
  if (user) {
    await fetch(`http://localhost:3000/${user.type.toLowerCase()}/users`, {
      method: 'POST',
      headers: {
        'x-api-key': 'fake',
        'tenant-id': 'flagright',
      },
      body: JSON.stringify(
        _.omit(user, '_id', 'PartitionKeyID', 'SortKeyID', 'type')
      ),
    })
  }
  createdUsers.add(userId)
}

async function verifyTransactionLocally(transactionId: string) {
  const transaction = await getRemoteTransaction(transactionId)
  const { originUserId, destinationUserId } = transaction
  await createUserLocally(originUserId)
  await createUserLocally(destinationUserId)

  return await (
    await fetch(
      `http://localhost:3000/transactions?validateOriginUserId=false&validateDestinationUserId=false`,
      {
        method: 'POST',
        headers: {
          'x-api-key': 'fake',
          'tenant-id': 'flagright',
        },
        body: JSON.stringify(
          _.omit(
            transaction,
            '_id',
            'PartitionKeyID',
            'SortKeyID',
            'executedRules',
            'hitRules',
            'status',
            'events',
            'originUser',
            'destinationUser'
          )
        ),
      }
    )
  ).json()
}

async function main() {
  if (transactionIds.length === 0) {
    return
  }

  execSync('npm run recreate-local-ddb --table=Tarpon >/dev/null 2>&1')
  console.info('Recreated Tarpon DynamoDB table')
  const results = []
  for (let i = 0; i < transactionIds.length; i += 1) {
    results.push(await verifyTransactionLocally(transactionIds[i]))
    console.info(`${i + 1}. Verified transaction ${transactionIds[i]}`)
  }
  const outputPath = path.join(
    __dirname,
    '.output',
    `${new Date().toISOString()}.json`
  )
  fs.ensureFileSync(outputPath)
  fs.writeJsonSync(outputPath, results, { spaces: 2 })
  console.info(`\nDone. See results: ${outputPath}`)
}

main().catch((e) => console.error(e))
