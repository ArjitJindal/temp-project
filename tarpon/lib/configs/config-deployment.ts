import { Environment } from 'aws-cdk-lib'

export type DeployConfig = {
  env: Environment
  github: {
    GITHUB_CONNECTION_ARN: string
    OWNER: 'flagright'
    REPO: 'tarpon'
    BRANCH: string
  }
}

export const config: DeployConfig = {
  env: { account: '073830519512', region: 'eu-central-1' },
  github: {
    GITHUB_CONNECTION_ARN:
      'arn:aws:codestar-connections:eu-central-1:073830519512:connection/fd1ebfb1-8fdf-41ae-aa9f-e7cda307f490',
    OWNER: 'flagright',
    REPO: 'tarpon',
    BRANCH: 'main',
  },
}
