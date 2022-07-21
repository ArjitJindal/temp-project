import { connectToDB } from '@/utils/mongoDBUtils'

// We use a separate DB for each jest worker. Then different test files running in parallel
// won't interfere with each other.
export const MONGO_DB_NAME = `tarpon-test-${process.env.JEST_WORKER_ID}`

export async function getMongoClient() {
  return await connectToDB(MONGO_DB_NAME)
}
