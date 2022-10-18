import dayjs from '@/utils/dayjs'
import { RiskLevel } from '@/@types/openapi-public/RiskLevel'

type OptionRequirements = Record<RiskLevel, number>

export const riskLevelPrecendence: OptionRequirements = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  VERY_HIGH: 5,
}

export const getAgeFromTimestamp = (timestamp: number) => {
  return dayjs().diff(dayjs(timestamp), 'year')
}
