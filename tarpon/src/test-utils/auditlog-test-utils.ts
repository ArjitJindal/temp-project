export let skipAuditLogs = false

export const setSkipAuditLogs = () => {
  beforeAll(() => {
    skipAuditLogs = true
  })
  afterAll(() => {
    skipAuditLogs = false
  })
}
