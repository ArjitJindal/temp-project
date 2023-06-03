// We use a separate DB for each jest worker. Then different test files running in parallel
// won't interfere with each other.
export const MONGO_TEST_DB_PREFIX = '__TEST__'
export const MONGO_TEST_DB_NAME = `${MONGO_TEST_DB_PREFIX}${process.env.JEST_WORKER_ID}`
