import { WebClient } from '@slack/web-api'
import {
  getLinearTicketIDByGitRef,
  updateTicketStatusByID,
} from './utils/linear'
import { getToBeReleasedHeadRefs } from './utils/git'

const slackifyMarkdown = require('slackify-markdown')

const DEPLOYMENT_SLACK_CHANNEL = 'C03L5KRE2E8'
const QA_SLACK_USER_GROUP_ID = 'S074CS7E0EP'
const READY_TO_TEST_TICKETS_URL =
  'https://www.notion.so/flagright/16d55dfca8e2436c9c7786ab7c62e04e?v=39e46a0c1172475bbb6f763cdd282a0e'

async function updateLinearTickets() {
  const headRefs = await getToBeReleasedHeadRefs()
  const linearTicketIds = headRefs
    .map(getLinearTicketIDByGitRef)
    .filter(Boolean) as string[]

  for (const ticketId of linearTicketIds) {
    await updateTicketStatusByID(ticketId, 'Ready to Test')
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
