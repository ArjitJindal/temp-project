import dayjsLib, { ConfigType, OptionType } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import durationPlugin, {
  Duration,
  DurationUnitType,
} from 'dayjs/plugin/duration'

dayjsLib.extend(utc)
dayjsLib.extend(durationPlugin)
dayjsLib.extend(timezone)

export type Dayjs = dayjsLib.Dayjs

export default function dayjs(
  config?: ConfigType,
  format?: OptionType
): dayjsLib.Dayjs {
  const dayjs = dayjsLib(config, format)
  return dayjs.utc()
}

export function duration(time: number, unit?: DurationUnitType): Duration {
  return dayjsLib.duration(time, unit)
}
