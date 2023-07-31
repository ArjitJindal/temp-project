import { execSync } from 'child_process'
import { exit } from 'process'
import { Octokit } from '@octokit/core'
import {
  CloudFormationClient,
  DeleteStackCommand,
  ListStacksCommand,
} from '@aws-sdk/client-cloudformation'
import { logger } from '@/core/logger'
import { getSecret } from '@/utils/secrets-manager'

const cleanUp = async () => {
  const githubAuth = (await getSecret(
    'arn:aws:secretsmanager:eu-central-1:911899431626:secret:githubCreds-i1u6Uv'
  )) as { auth: string }

  const octokit = new Octokit(githubAuth)
  const response = await octokit.request('GET /repos/flagright/orca/pulls', {
    owner: 'OWNER',
    repo: 'REPO',
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
    per_page: 100,
  })

  const liveQaEnvs: string[] = response.data.map((pr: any) => {
    const output = execSync(
      `echo "${pr.head.ref}" | shasum | head -c5`
    ).toString()
    return `qa${output}`
  })

  const client = new CloudFormationClient({ region: 'eu-central-1' })

  let next: string | undefined = undefined
  do {
    const command: ListStacksCommand = new ListStacksCommand({
      NextToken: next,
    })
    const stacksResponse = await client.send(command)
    const summaries = stacksResponse.StackSummaries

    if (!summaries) {
      break
    }

    for (const summary of summaries) {
      const stackName = summary.StackName
      if (!stackName || summary.StackStatus === 'DELETE_COMPLETE') {
        continue
      }

      if (
        stackName.startsWith('dev-phytoplankton-qa') ||
        stackName.startsWith('dev-tarpon-qa')
      ) {
        if (!liveQaEnvs.some((qaEnv) => stackName.indexOf(qaEnv) > -1)) {
          console.log(`Deleting ${stackName}`)
          const deleteCommand = new DeleteStackCommand({
            StackName: stackName,
          })
          await client.send(deleteCommand)
        }
      }
    }

    next = stacksResponse.NextToken
  } while (next)
}

cleanUp()
  .then(() => console.log('Cleanup finished!'))
  .catch((e) => {
    logger.error(e)
    exit(1)
  })
