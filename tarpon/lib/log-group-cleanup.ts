import { backOff } from 'exponential-backoff'
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  DeleteLogGroupCommand,
  LogGroup,
  PutRetentionPolicyCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import { getLiveQAEnvs, getQAEnvName } from './utils'
import { envIsNot } from '@/utils/env'
import { logger } from '@/core/logger'

class FatalError extends Error {}
export async function cleanUpStaleLogGroups() {
  if (envIsNot('dev')) {
    logger.error('Not dev environment. Skipping...')
    return
  }
  const liveQaEnvs = await getLiveQAEnvs()

  const cloudWatchLogsClient = new CloudWatchLogsClient({
    region: 'eu-central-1',
  })
  let logGroupNextToken: string | undefined = undefined

  let totalLogGroup = 0,
    deleteLogGroup = 0

  do {
    try {
      logger.info('Processing new batch')
      const command = new DescribeLogGroupsCommand({
        nextToken: logGroupNextToken,
      })
      const response = await cloudWatchLogsClient.send(command)

      // promise to delete log groups
      const promises = response.logGroups?.map(async (group: LogGroup) => {
        // backoff to handle rate limit error
        return await backOff(
          async () => {
            if (group.logGroupName) {
              const qa = getQAEnvName(group.logGroupName)
              if (qa && !liveQaEnvs.includes(qa)) {
                const command = new DeleteLogGroupCommand({
                  logGroupName: group.logGroupName,
                })
                await cloudWatchLogsClient.send(command)
                logger.info(`Deleted ${group.logGroupName} of qa ${qa} 🔪`)
                return 'deleted'
              } else if (qa && !group.retentionInDays) {
                const command = new PutRetentionPolicyCommand({
                  logGroupName: group.logGroupName,
                  retentionInDays: 14,
                })
                await cloudWatchLogsClient.send(command)
                logger.info(`Updated ${group.logGroupName} 🔧`)
                return 'updated'
              }
            }
            return 'skipped'
          },
          {
            maxDelay: 10 * 1000,
            numOfAttempts: 5,
            retry: (e) => !(e instanceof FatalError),
          }
        )
      })

      const results = (await Promise.all(promises)).filter(
        (r) => r === 'deleted'
      )
      deleteLogGroup += results.length
      totalLogGroup += response.logGroups.length
      logGroupNextToken = response.nextToken
    } catch (error) {
      logger.error(error)
    }
  } while (logGroupNextToken)

  logger.info(`Total log group left ${totalLogGroup - deleteLogGroup}`)
  logger.info(`Deleted log group ${deleteLogGroup}`)
}
