import pluralize from 'pluralize';
import dayjs from '@/utils/dayjs';

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
interface Duration {
  hours: number;
  minutes: number;
  seconds: number;
  days: number;
  years: number;
  months: number;
}
export function getDuration(milliseconds: number): Duration {
  const duration = dayjs.duration(milliseconds);
  return {
    hours: duration.hours(),
    minutes: duration.minutes(),
    seconds: duration.seconds(),
    days: duration.days(),
    years: duration.years(),
    months: duration.months(),
  };
}

export function formatDuration(
  duration: Partial<Duration>,
  granularitiesCount: number = 3,
): string {
  const parts = [
    duration?.years ? `${duration.years}${pluralize(' yr', duration.years)}` : '',
    duration?.months ? `${duration.months}${pluralize(' mo', duration.months)}` : '',
    duration?.days ? `${duration.days}${pluralize(' d', duration.days)}` : '',
    duration?.hours ? `${duration.hours}${pluralize(' hr', duration.hours)}` : '',
    duration?.minutes ? `${duration.minutes}${pluralize(' min', duration.minutes)}` : '',
    duration?.seconds ? `${duration.seconds}${pluralize(' sec', duration.seconds)}` : '',
  ];

  return parts.filter(Boolean).slice(0, granularitiesCount).join(' ');
}
