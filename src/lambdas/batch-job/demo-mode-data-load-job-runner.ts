import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { copyCollections } from '@/utils/seed'
import { Case } from '@/@types/openapi-internal/Case'
import { AccountsService } from '@/services/accounts'
import { Account } from '@/@types/openapi-internal/Account'
import { Assignment } from '@/@types/openapi-internal/Assignment'

const FLAGRIGHT = 'flagright'

const getRandomInt = (max: number) => {
  return Math.floor(Math.random() * max)
}

const getRandomAssigneeObject = (accounts: Account[]): Assignment => {
  const randomAccountIndex = getRandomInt(accounts.length)

  return {
    assigneeUserId: accounts[randomAccountIndex].id,
    timestamp: Date.now(),
  }
}

const casesMappingFn = async (
  document: Case,
  accounts: Account[]
): Promise<Case> => {
  return {
    ...document,
    assignments: accounts?.length
      ? [getRandomAssigneeObject(accounts)]
      : undefined,
    reviewAssignments: accounts?.length
      ? [getRandomAssigneeObject(accounts)]
      : undefined,
    alerts:
      document.alerts?.map((a) => ({
        ...a,
        assignments: accounts?.length
          ? [getRandomAssigneeObject(accounts)]
          : undefined,
        reviewAssignments: accounts?.length
          ? [getRandomAssigneeObject(accounts)]
          : undefined,
      })) ?? [],
  }
}

const mappingFn = async (
  collectionName: string,
  document: any,
  data: { accounts: Account[] }
) => {
  switch (collectionName) {
    case 'cases':
      return await casesMappingFn(document, data.accounts)
    default:
      return document
  }
}

export class DemoModeDataLoadJobRunner implements BatchJobRunner {
  public async run(job: DemoModeDataLoadBatchJob) {
    // Create collections
    const { tenantId } = job
    const mongoClient = await getMongoDbClient()

    console.log('Generate collections names and S3 keys')
    const db = mongoClient.db()

    const mongoDb = await getMongoDbClient()
    const accountsService = new AccountsService(
      { auth0Domain: process.env.AUTH0_DOMAIN as string },
      { mongoDb: mongoDb }
    )

    const tenant = await accountsService.getTenantById(tenantId)

    const accounts =
      tenant != null ? await accountsService.getTenantAccounts(tenant) : []

    await copyCollections(
      mongoClient,
      FLAGRIGHT,
      db,
      tenantId,
      db,
      async (collectionName, document) => {
        return await mappingFn(collectionName, document, {
          accounts,
        })
      }
    )
    await mongoClient.close()
  }
}
