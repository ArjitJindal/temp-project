import { execSync } from 'child_process'
import { getTarponConfig } from '@flagright/lib/constants/config'

export const refreshCredentials = async (stage: string, region: string) => {
  const config = getTarponConfig(stage, region)
  if (!config) {
    console.error('Invalid stage or region')
    process.exit(1)
  }
  console.info('Refreshing AWS credentials')

  const commands = [
    `ASSUME_ROLE_ARN="arn:aws:iam::${config.env.account}:role/CodePipelineDeployRole"`,
    `TEMP_ROLE=$(aws sts assume-role --role-arn $ASSUME_ROLE_ARN --role-session-name deploy-${config.region})`,
    'export AWS_ACCESS_KEY_ID=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.AccessKeyId")',
    'export AWS_SECRET_ACCESS_KEY=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SecretAccessKey")',
    'export AWS_SESSION_TOKEN=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SessionToken")',
  ]

  execSync(commands.join(' && '), { stdio: 'inherit' })
}
