// We use a separate DB for each jest worker. Then different test files running in parallel
// won't interfere with each other.
export const MONGO_TEST_DB_NAME = `tarpon-test-${process.env.JEST_WORKER_ID}`
