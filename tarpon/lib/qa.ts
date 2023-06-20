import _ from 'lodash'

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
export function getQaApiKeyId(): string {
  // NOTE: Each api key can only be used for at most 10 usage plans.
  // We use a pool of API keys to spread out the usage.
  const qaSubdomain = process.env.QA_SUBDOMAIN as string
  const apiKeyIdIndex =
    _.sum(qaSubdomain.split('').map((c) => c.charCodeAt(0))) %
    QA_API_KEY_IDS.length

  return QA_API_KEY_IDS[apiKeyIdIndex]
}
