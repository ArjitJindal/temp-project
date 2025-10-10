import { nanoid } from 'nanoid'

// NOTE: Use this for getting a unique tenant ID in each test suite, then we can support
// running tests in parallel without interferring each other.
export function getTestTenantId() {
  return `TEST-TENANT-${nanoid()}`
}
