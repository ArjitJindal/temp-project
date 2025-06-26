import { WebClient } from '@slack/web-api'
import {
  getLinearTicketIDByGitRef,
  TicketStatus,
  updateTicketStatusByID,
} from './utils/linear'
import { getToBeReleasedHeadRefs } from './utils/git'
import { compact } from 'lodash'

const slackifyMarkdown = require('slackify-markdown')

const DEPLOYMENT_SLACK_CHANNEL = 'C03L5KRE2E8'
const QA_SLACK_USER_GROUP_ID = 'S074CS7E0EP'
const READY_TO_TEST_TICKETS_URL =
  'https://linear.app/flagright/team/FDT/view/ready-to-test-dc1f521f4edd'

async function updateLinearTickets() {
  const headRefs = await getToBeReleasedHeadRefs()
  const linearTicketIds = compact(headRefs.map(getLinearTicketIDByGitRef))

  for (const ticketId of linearTicketIds) {
    await updateTicketStatusByID(ticketId, TicketStatus.ReadyToTest, [
      TicketStatus.QaFail,
    ])
  }
}

async function notifySlack() {
  const slackClient = new WebClient(process.env.SLACK_TOKEN)
  const message = slackifyMarkdown(
    `<!subteam^${QA_SLACK_USER_GROUP_ID}> Sandbox is ready for testing (<${READY_TO_TEST_TICKETS_URL}|tickets>)`
  )
  await slackClient.chat.postMessage({
    channel: DEPLOYMENT_SLACK_CHANNEL,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: message },
      },
    ],
  })
}

async function main() {
  await updateLinearTickets()
  await notifySlack()
  console.info('Done')
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
