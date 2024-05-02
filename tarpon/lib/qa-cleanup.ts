import { execSync } from 'child_process'
import { backOff } from 'exponential-backoff'
import { Octokit } from '@octokit/core'
import {
  CloudFormationClient,
  DeleteStackCommand,
  ListStacksCommand,
  DescribeStacksCommand,
  Stack,
} from '@aws-sdk/client-cloudformation'
import { getSecretByName } from '@/utils/secrets-manager'
import { envIsNot } from '@/utils/env'
import { logger } from '@/core/logger'

class FatalError extends Error {}
export async function cleanUpStaleQaEnvs() {
  if (envIsNot('dev')) {
    logger.error('Not dev environment. Skipping...')
    return
  }
  const githubAuth = await getSecretByName('githubCreds')
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
  const orphanStackNames: string[] = []

  // Find orphan stacks
  let next: string | undefined = undefined
  do {
    const command: ListStacksCommand = new ListStacksCommand({
      NextToken: next,
    })
    const stacksResponse = await client.send(command)
    orphanStackNames.push(
      ...(stacksResponse.StackSummaries?.filter(
        ({ StackName, StackStatus, ParentId }) =>
          !ParentId &&
          StackStatus !== 'DELETE_COMPLETE' &&
          !StackStatus?.includes('IN_PROGRESS') &&
          StackName &&
          (StackName?.startsWith('dev-phytoplankton-qa') ||
            StackName?.startsWith('dev-tarpon-qa')) &&
          !liveQaEnvs.some((qaEnv) => StackName.indexOf(qaEnv) > -1)
      ).map(({ StackName }) => StackName ?? '') ?? [])
    )
    next = stacksResponse.NextToken
  } while (next)

  // Delete orphan stacks
  if (orphanStackNames.length === 0) {
    logger.info('No orphan stacks found ✅')
  } else {
    logger.warn(
      `Found ${orphanStackNames.length} orphan stacks: ${orphanStackNames
        .map((e) => `- ${e}`)
        .join('\n')}\n`
    )
  }

  for (const stackName of orphanStackNames) {
    await backOff(
      async () => {
        logger.info(`Deleting ${stackName}`)
        const deleteCommand = new DeleteStackCommand({
          StackName: stackName,
        })
        await client.send(deleteCommand)

        // Polling for stack status
        await backOff(
          async () => {
            let stack: Stack | undefined
            try {
              const describeCommand = new DescribeStacksCommand({
                StackName: stackName,
              })
              const describeResult = await client.send(describeCommand)
              stack = describeResult?.Stacks?.[0]
            } catch (e) {
              const errMsg = (e as Error).message
              if (errMsg.includes('does not exist')) {
                logger.info(`Deleted ${stackName} 🔪`)
                return
              }
              throw new FatalError(errMsg)
            }

            if (!stack) {
              logger.info(`Deleted ${stackName} 🔪`)
              return
            }

            const errorMsg = `Failed to delete stack ${stackName} (${stack.StackStatus}): ${stack.StackStatusReason}`
            if (stack.StackStatus?.includes('FAILED')) {
              throw new FatalError(errorMsg)
            }
            logger.info(`Waiting...`)
            throw new Error(errorMsg)
          },
          {
            startingDelay: 10 * 1000,
            maxDelay: 30 * 1000,
            numOfAttempts: 10,
            retry: (e) => !(e instanceof FatalError),
          }
        )
      },
      {
        numOfAttempts: 3,
        retry: (_e, attemptNumber) => {
          logger.warn(
            `Failed to delete ${stackName}. Retry (${attemptNumber} attempt)`
          )
          return true
        },
      }
    )
  }
}
