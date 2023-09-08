import dayjsLib, { ConfigType } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import durationPlugin, {
  Duration,
  DurationUnitType,
} from 'dayjs/plugin/duration'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import { Timezone as ApiTimezone } from '@/@types/openapi-internal/Timezone'

dayjsLib.extend(utc)
dayjsLib.extend(durationPlugin)
dayjsLib.extend(timezone)
dayjsLib.extend(weekOfYear)
dayjsLib.extend(localizedFormat)

dayjsLib.locale('en')

export type Timezone = ApiTimezone
export type Dayjs = dayjsLib.Dayjs

export default function dayjs(
  config?: ConfigType,
  format?: string
): dayjsLib.Dayjs {
  if (format != null) {
    return dayjsLib.tz(config, format, 'Etc/UTC').utcOffset(0)
  }
  return dayjsLib.tz(config, 'Etc/UTC').utcOffset(0)
}

export function duration(time: number, unit?: DurationUnitType): Duration {
  return dayjsLib.duration(time, unit)
}

export const convertToDays = (value: number, unit: string) => {
  switch (unit) {
    case 'DAYS':
      return value
    case 'MONTHS':
      return value * 30
    case 'YEARS':
      return value * 365
    default:
      return value
  }
}

export const WEEKDAY_NUMBERS = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

export function getDefaultTimezone(): Timezone {
  return 'Etc/UTC'
}
