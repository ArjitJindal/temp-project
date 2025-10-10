import { Config } from '@flagright/lib/config/config'

export const getAssumeRoleCommands = (config: Config) => [
  `ASSUME_ROLE_ARN="arn:aws:iam::${config.env.account}:role/CodePipelineDeployRole"`,
  `TEMP_ROLE=$(aws sts assume-role --role-arn $ASSUME_ROLE_ARN --role-session-name deploy-${config.region})`,
  'export TEMP_ROLE',
  'export NODE_OPTIONS=--max-old-space-size=4096',
  'export AWS_ACCESS_KEY_ID=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.AccessKeyId")',
  'export AWS_SECRET_ACCESS_KEY=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SecretAccessKey")',
  'export AWS_SESSION_TOKEN=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SessionToken")',
]
