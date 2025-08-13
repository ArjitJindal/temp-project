import { exit } from 'process'
import { execSync } from 'child_process'
import { AssumeRoleCommand, STS } from '@aws-sdk/client-sts'

const main = async () => {
  const env = process.argv[2]

  if (!env) {
    console.info(`
Usage: yarn deploy:cdktf <stage:region>

Example:
  yarn deploy:cdktf dev:eu1
  yarn deploy:cdktf sandbox:asia-1

Defaulting to 'dev' stage and 'eu-1' region...
          `)
  }
  const selectedEnv = env || 'dev:eu-1'
  const [_, region] = selectedEnv.split(':')

  try {
    console.info(
      `Refreshing AWS credentials for cdKTF deployment in ${selectedEnv}`
    )
    const sts = new STS({
      region: process.env.AWS_REGION,
    })

    const assumeRoleCommand = new AssumeRoleCommand({
      RoleArn: process.env.ASSUME_ROLE_ARN as string,
      RoleSessionName: `deploy-${region}`,
    })

    const assumeRoleResult = await sts.send(assumeRoleCommand)

    process.env.AWS_ACCESS_KEY_ID = assumeRoleResult.Credentials?.AccessKeyId
    process.env.AWS_SECRET_ACCESS_KEY =
      assumeRoleResult.Credentials?.SecretAccessKey
    process.env.AWS_SESSION_TOKEN = assumeRoleResult.Credentials?.SessionToken
    console.info('Refreshed AWS credentials')
  } catch (e) {
    console.error('Failed to refresh AWS credentials')
    console.error(e)
    throw e
  }

  const command = `ENV='${selectedEnv}' ASSUME_ROLE_ARN='' cdktf deploy --quiet --auto-approve`

  execSync(command, { stdio: 'inherit' })
}

void main()
  .then(() => exit(0))
  .catch((e) => {
    console.error(e)
    exit(1)
  })
