export function stageAndRegion() {
  let [stage, region] = process.env.ENV?.split(':') || [] // eslint-disable-line prefer-const

  if (!region) {
    region = process.env.REGION || 'eu-1'
  }

  // NOTE: QA env is 'dev:user'
  if (stage === 'dev') {
    return [stage, 'eu-1']
  }
  return [stage, region]
}
