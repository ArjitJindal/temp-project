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

dayjsLib.extend(utc)
dayjsLib.extend(durationPlugin)
dayjsLib.extend(timezone)
dayjsLib.extend(weekOfYear)
dayjsLib.extend(localizedFormat)
dayjsLib.extend(relativeTime)

export {
  dayjsLib as default,
  ConfigType,
  OptionType,
  DurationUnitType,
  CreateDurationType,
  Duration,
  ManipulateType,
}
