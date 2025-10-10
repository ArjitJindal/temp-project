export type BatchRerunUsersJobType = 'RERUN_RISK_SCORING'

export type BatchRerunUsersJobPayload = {
  jobType: BatchRerunUsersJobType
  userIds: string[]
  tenantId: string
  jobId: string
}
