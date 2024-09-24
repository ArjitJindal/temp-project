export function stageAndRegion() {
  const [stage, region = 'eu-1'] = process.env.ENV?.split(':') || []
  // NOTE: QA env is 'dev:user'
  if (stage === 'dev') {
    return [stage, 'eu-1']
  }
  return [stage, region]
}
