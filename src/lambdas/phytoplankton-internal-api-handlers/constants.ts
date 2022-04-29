export type DashboardTimeFrameType = 'YEAR' | 'MONTH' | 'DAY'
export const timeFrameValues = {
  YEAR: 'YEAR',
  MONTH: 'MONTH',
  DAY: 'DAY',
}

export type TransactionDashboardStats = {
  _id: string
  transactionCount: number
}
