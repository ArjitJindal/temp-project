import dayjs, { Dayjs } from '@/utils/dayjs'

export function getTimeFromRegion(region?: string): Dayjs {
  region = region || process.env.AWS_REGION || 'eu-west-2'
  const regionTimezones: Record<string, string> = {
    // North America
    'us-east-1': 'America/New_York', // N. Virginia
    'us-east-2': 'America/Chicago', // Ohio
    'us-west-1': 'America/Los_Angeles', // N. California
    'us-west-2': 'America/Los_Angeles', // Oregon
    'ca-central-1': 'America/Toronto', // Canada

    // South America
    'sa-east-1': 'America/Sao_Paulo', // São Paulo

    // Europe
    'eu-west-1': 'Europe/Dublin', // Ireland
    'eu-west-2': 'Europe/London', // London
    'eu-west-3': 'Europe/Paris', // Paris
    'eu-central-1': 'Europe/Berlin', // Frankfurt
    'eu-south-1': 'Europe/Rome', // Milan
    'eu-north-1': 'Europe/Stockholm', // Stockholm

    // Asia Pacific
    'ap-east-1': 'Asia/Hong_Kong', // Hong Kong
    'ap-south-1': 'Asia/Kolkata', // Mumbai
    'ap-northeast-1': 'Asia/Tokyo', // Tokyo
    'ap-northeast-2': 'Asia/Seoul', // Seoul
    'ap-northeast-3': 'Asia/Tokyo', // Osaka (using Tokyo as Osaka isn't available)
    'ap-southeast-1': 'Asia/Singapore', // Singapore
    'ap-southeast-2': 'Australia/Sydney', // Sydney

    // Middle East
    'me-south-1': 'Asia/Bahrain', // Bahrain
    'me-central-1': 'Asia/Dubai', // UAE

    // Africa
    'af-south-1': 'Africa/Johannesburg', // Cape Town
  }

  const timezone = regionTimezones[region] || 'UTC' // Default to UTC if region not found
  return dayjs().tz(timezone)
}

export interface JobRunConfig {
  windowStart: number
  windowEnd: number
  runIntervalInHours: number
  checkCallInterval: number
}

const HOURS_IN_DAY = 24

const isRunIntervalMultiple = (config: JobRunConfig, hour: number): boolean => {
  let hoursFromStart: number
  if (config.windowEnd < config.windowStart) {
    if (hour >= config.windowStart) {
      hoursFromStart = hour - config.windowStart
    } else {
      hoursFromStart = HOURS_IN_DAY - config.windowStart + hour
    }
  } else {
    hoursFromStart = hour - config.windowStart
  }
  return hoursFromStart % config.runIntervalInHours === 0
}

const isWithinWindow = (config: JobRunConfig, hour: number): boolean => {
  if (config.windowEnd < config.windowStart) {
    return hour >= config.windowStart || hour < config.windowEnd
  }
  return hour >= config.windowStart && hour < config.windowEnd
}

const isRunMinute = (config: JobRunConfig, minute: number): boolean => {
  return minute >= 0 && minute < config.checkCallInterval
}

export const shouldRun = (config: JobRunConfig, now: Dayjs): boolean => {
  if (config.checkCallInterval > 60) {
    throw Error('Calling of the fucntion should be less than a hour')
  }
  const hour = now.hour()
  const minute = now.minute()

  if (!isWithinWindow(config, hour)) {
    return false
  }

  if (isRunIntervalMultiple(config, hour) && isRunMinute(config, minute)) {
    return true
  }

  return false
}
