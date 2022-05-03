import { DashboardTimeFrameType, timeFrameValues } from './constants'

export const timeframeToTimestampConverter = (
  timeframe: DashboardTimeFrameType
): number => {
  const afterTimeStamp = new Date()
  if (timeframe === timeFrameValues.MONTH) {
    afterTimeStamp.setMonth(afterTimeStamp.getMonth() - 1)
  } else if (timeframe === timeFrameValues.DAY) {
    afterTimeStamp.setDate(afterTimeStamp.getDate() - 1)
  } else {
    afterTimeStamp.setFullYear(afterTimeStamp.getFullYear() - 1)
  }
  return afterTimeStamp.getTime()
}

export const padToDate = (dateNum: number) => {
  return dateNum.toString().padStart(2, '0')
}
