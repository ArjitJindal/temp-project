import { Environment } from 'aws-cdk-lib'

export type DeployConfig = {
  env: Environment
  budget: {
    CODEBUILD: number
    EC2: number
    CODEPIPELINE: number
  }
  github: {
    GITHUB_CONNECTION_ARN: string
    OWNER: 'flagright'
    REPO: 'orca'
    BRANCH: string
  }
}

export const config: DeployConfig = {
  env: { account: '073830519512', region: 'eu-central-1' },
  budget: {
    CODEBUILD: 150,
    EC2: 150,
    CODEPIPELINE: 1,
  },
  github: {
    GITHUB_CONNECTION_ARN:
      'arn:aws:codestar-connections:eu-central-1:073830519512:connection/fd1ebfb1-8fdf-41ae-aa9f-e7cda307f490',
    OWNER: 'flagright',
    REPO: 'orca',
    BRANCH: 'main',
  },
}
