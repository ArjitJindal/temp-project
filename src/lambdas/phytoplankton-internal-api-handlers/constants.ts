export type deashboardTimeFrameType = 'YEAR' | 'MONTH' | 'DAY'
export const timeFrameValues = {
  YEAR: 'YEAR',
  MONTH: 'MONTH',
  DAY: 'DAY',
}

export const padToDate = (dateNum: number) => {
  return dateNum.toString().padStart(2, '0')
}

export type TransactionDashboardStats = {
  _id: string
  transactionCount: number
}
