export const FLAGRIGHT_TENANT_ID = 'flagright'
export const SENTRY_DSN =
  'https://ecefa05b5cfb4b5998ccc8d4907012c8@o1295082.ingest.sentry.io/6567808'
// The maximum file size allowed for a file in S3. This is to prevent large files from being uploaded to S3.
export const MAX_FILE_SIZE_BYTES = 10 * 1000 * 1000 // 10 MB
// This is a comma-separated list of file extensions. For example: '.txt,.csv,.sar'
export const ACCEPTED_FILE_EXTENSIONS_SET = new Set([
  '.jpg',
  '.docx',
  '.png',
  '.jpeg',
  '.pdf',
  '.csv',
  '.xlsx',
  '.xlsm',
  '.xltm',
  '.heic',
  '.txt',
  '.mp4',
  '.mp3',
  '.webp',
  '.json',
  '.doc',
  '.js',
  '.tif',
  '.dotx',
  '.eml',
  '.sar',
])
export const MONTH_DATE_FORMAT = '%Y-%m'
export const DAY_DATE_FORMAT = '%Y-%m-%d'
export const HOUR_DATE_FORMAT = '%Y-%m-%dT%H'

export const MONTH_DATE_FORMAT_JS = 'YYYY-MM'
export const DAY_DATE_FORMAT_JS = 'YYYY-MM-DD'
export const HOUR_DATE_FORMAT_JS = 'YYYY-MM-DD[T]HH'
export const DATE_TIME_FORMAT_JS = 'YYYY-MM-DD HH:mm:ss'
