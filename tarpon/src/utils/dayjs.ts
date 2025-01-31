import dayjsLib, {
  ConfigType,
  DurationUnitType,
  Duration,
} from '@flagright/lib/utils/dayjs'
import { Timezone as ApiTimezone } from '@/@types/openapi-internal/Timezone'

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

export function convertDateFormat(
  year: string,
  month: string,
  date: string
): string {
  if (!year) {
    return ''
  }

  const monthMap: Record<string, string> = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  }

  const numericMonth = month ? monthMap[month] || month : ''

  const { format, d } =
    !numericMonth && !date
      ? { format: 'YYYY', d: `${year}` }
      : numericMonth && !date
      ? { format: 'YYYY-MM', d: `${year}-${numericMonth}` }
      : date
      ? { format: 'YYYY-MM-DD', d: `${year}-${numericMonth}-${date}` }
      : { format: '', d: '' }

  if (!format || !d) {
    return ''
  }

  return d
}
