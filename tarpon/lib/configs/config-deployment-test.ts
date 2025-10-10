/**
 * To test new pipeline changes without interfering the existing pipeline, do the following steps
 * 1. Change BRANCH to your branch name
 * 2. Deploy the pipeline by running `npm run deploy:pipeline-test:clean`
 * 3. Trigger the pipeline by pushing new commits to your branch
 * 4. After the test is finished, delete `tarpon-pipeline` CloudFormation stack in us-east-2 region
 */

import { DeployConfig } from './config-deployment'

export const config: DeployConfig = {
  env: { account: '073830519512', region: 'us-east-2' },
  budget: {
    CODEBUILD: 5,
    EC2: 5,
    CODEPIPELINE: 0,
  },
  github: {
    GITHUB_CONNECTION_ARN:
      'arn:aws:codestar-connections:eu-central-1:073830519512:connection/e7342cf6-a595-4984-a415-08f15ddbaa47',
    OWNER: 'flagright',
    REPO: 'orca',
    BRANCH: 'orca-pipline-stack',
  },
}
