import { sum } from 'lodash'

const QA_API_KEY_IDS = [
  'c4fr2s8zmi',
  'nzwxj76073',
  'nnuqku01gg',
  'd1mh4vfs79',
  '0vdidutr8c',
  'ryxami7tcd',
  'jvdub2angl',
  'sx8jv69vmc',
  'lriigh9bri',
  '4wp619m7p3',
]
const QA_INTEGRATION_TEST_API_KEY_IDS = [
  'f83m2gslq5',
  'gt5rfjnyd8',
  'j94vy0q3tk',
  'm5fqexr88e',
  'okdld3sgck',
  'yc0z5dhtwb',
  'id9h3tfim3',
  'wnoj5eydsj',
  'wdy7web128',
  'iuoy2hxdtg',
]
export function getQaApiKeyId(): string {
  return getQaApiKeyIdFromPool(QA_API_KEY_IDS)
}

export function getQaIntegrationTestApiKeyId(): string {
  return getQaApiKeyIdFromPool(QA_INTEGRATION_TEST_API_KEY_IDS)
}

function getQaApiKeyIdFromPool(apiKeyPool: string[]): string {
  // NOTE: Each api key can only be used for at most 10 usage plans.
  // We use a pool of API keys to spread out the usage.
  const qaSubdomain = (process.env.QA_SUBDOMAIN as string) || ''
  const apiKeyIdIndex =
    sum(qaSubdomain.split('').map((c) => c.charCodeAt(0))) % apiKeyPool.length

  return apiKeyPool[apiKeyIdIndex]
}

export function isQaEnv() {
  return process.env.ENV === 'dev:user'
}
