import { execSync } from 'child_process'
import { refreshCredentials } from './utils'

const main = async () => {
  // example: yarn deploy:sandbox:ci --region=asia-1 --stage=dev
  const args = process.argv.slice(2)
  const region = args.find((arg) => arg.startsWith('--region='))?.split('=')[1]
  const stage = args.find((arg) => arg.startsWith('--stage='))?.split('=')[1]
  const isPipeline = args.includes('--CI')
  const clean = args.includes('--clean')
  const synth = args.includes('--synth')

  if (!stage) {
    console.error('Stage is required')
    process.exit(1)
  }
  // region is required for sandbox and prod
  if (!region && (stage === 'sandbox' || stage === 'prod')) {
    console.error('Region is required')
    process.exit(1)
  }

  if (clean) {
    execSync('yarn clear', { stdio: 'inherit' })
    execSync('yarn', { stdio: 'inherit' })
  }

  const stageConfig = {
    dev: {
      stackName: 'dev-tarpon',
      validateRegion: () => true,
      env: 'dev',
    },
    sandbox: {
      stackName: 'sandbox-tarpon',
      validateRegion: (r: string) => ['asia-1', 'eu-1'].includes(r),
      env: `sandbox:${region}`,
    },
    prod: {
      stackName: 'prod-tarpon',
      validateRegion: (r: string) =>
        [
          'asia-1',
          'asia-2',
          'asia-3',
          'eu-1',
          'eu-2',
          'au-1',
          'me-1',
          'us-1',
        ].includes(r),
      env: `prod:${region}`,
    },
  }

  const config = stageConfig[stage as keyof typeof stageConfig]

  if (!config) {
    console.error('Invalid stage')
    process.exit(1)
  }

  if (region && !config.validateRegion(region)) {
    console.error(`Invalid region for ${stage}`)
    process.exit(1)
  }

  process.env.ENV = config.env

  if (region && isPipeline) {
    await refreshCredentials(stage, region)
  }

  if (clean) {
    execSync(`./torpedo/build.sh`, { stdio: 'inherit' })
    execSync('yarn build', { stdio: 'inherit' })
    execSync('yarn openapi:augment', { stdio: 'inherit' })
    execSync(`npx cdk synth --quiet ${config.stackName}`, { stdio: 'inherit' })
    execSync('yarn cdktf:init', { stdio: 'inherit' })
  }

  if (synth) {
    execSync('yarn openapi:augment', { stdio: 'inherit' })
    execSync(`npx cdk synth --quiet ${config.stackName}`, { stdio: 'inherit' })
  }

  execSync(`npx cdk deploy ${config.stackName} --require-approval=never`, {
    stdio: 'inherit',
  })
  execSync('npm run cdktf:init', { stdio: 'inherit' })
  execSync(
    `npm run deploy:cdktf ${stage}:${region} ${isPipeline ? '--CI' : ''}`,
    {
      stdio: 'inherit',
    }
  )
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
