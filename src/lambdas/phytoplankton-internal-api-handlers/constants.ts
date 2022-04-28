export type DashboardTimeFrameType = 'YEAR' | 'MONTH' | 'DAY'
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

export const timeframeToTimestampConverter = (
  timeframe: DashboardTimeFrameType
): number => {
  let afterTimeStamp = new Date()
  if (timeframe === timeFrameValues.MONTH) {
    afterTimeStamp.setMonth(afterTimeStamp.getMonth() - 1)
  } else if (timeframe === timeFrameValues.DAY) {
    afterTimeStamp.setDate(afterTimeStamp.getDate() - 1)
  } else {
    afterTimeStamp.setFullYear(afterTimeStamp.getFullYear() - 1)
  }
  return afterTimeStamp.getTime()
}
