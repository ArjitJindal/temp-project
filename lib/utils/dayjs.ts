import dayjsLib, { ConfigType, OptionType, ManipulateType } from 'dayjs'

import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import relativeTime from 'dayjs/plugin/relativeTime'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import durationPlugin, {
  DurationUnitType,
  Duration,
  CreateDurationType,
} from 'dayjs/plugin/duration'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import weekday from 'dayjs/plugin/weekday'
import localeData from 'dayjs/plugin/localeData'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjsLib.extend(utc)
dayjsLib.extend(durationPlugin)
dayjsLib.extend(timezone)
dayjsLib.extend(weekOfYear)
dayjsLib.extend(localizedFormat)
dayjsLib.extend(relativeTime)
dayjsLib.extend(weekday)
dayjsLib.extend(localeData)
dayjsLib.extend(customParseFormat)

export {
  dayjsLib as default,
  ConfigType,
  OptionType,
  DurationUnitType,
  CreateDurationType,
  Duration,
  ManipulateType,
}
