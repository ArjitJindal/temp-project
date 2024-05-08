export type DashboardStatsRiskLevelDistributionData = {
  _id: number
  count: number
}
export type DashboardStatsKYCDistributionData = {
  _id: number
  count: number
}
export type TimeRange = {
  startTimestamp?: number
  endTimestamp?: number
}

export type GranularityValuesType = 'HOUR' | 'MONTH' | 'DAY'

export const CASE_GROUP_KEYS = {
  openCaseIds: {
    $addToSet: {
      $cond: {
        if: {
          $ne: ['$caseStatus', 'CLOSED'],
        },
        then: '$caseId',
        else: '$$REMOVE',
      },
    },
  },
  caseIds: {
    $addToSet: '$caseId',
  },
}

export const CASE_PROJECT_KEYS = {
  openCasesCount: {
    $size: { $ifNull: ['$openCaseIds', []] },
  },
  casesCount: {
    $size: { $ifNull: ['$caseIds', []] },
  },
}
