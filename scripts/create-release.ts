import { WebClient } from '@slack/web-api'
import {
  getNotionPageByTicketID,
  getNotionTicketIDByGitRef,
  updateTicketStatusByID,
} from './utils/notion'
import {
  createGitHubRelease,
  getPullRequest,
  getToBeReleasedHeadRefs,
} from './utils/git'

const slackifyMarkdown = require('slackify-markdown')

const CHANNELS = {
  PRODUCT_RELEASE: 'C05MPLSLQKC',
  DEPLOYMENT: 'C03L5KRE2E8',
} as const

const slackClient = new WebClient(process.env.SLACK_TOKEN)

async function getTicketInfoByPrNumber(prNumber: string) {
  const pr = await getPullRequest(prNumber)
  const headRef = pr.data.head.ref
  const notionTicketId = getNotionTicketIDByGitRef(headRef)
  if (!notionTicketId) {
    return null
  }
  return {
    ticketId: notionTicketId,
    url: (await getNotionPageByTicketID(notionTicketId)).url,
  }
}

const getFinalText = (
  releaseUrl: string,
  releaseNote: string,
  channel: keyof typeof CHANNELS
) => {
  // tag @closers groupId: S05G5GF1NDN
  if (channel === 'PRODUCT_RELEASE') {
    return slackifyMarkdown(
      `Hey <!subteam^S05G5GF1NDN>! We have a new deployment! 🚀🚀🚀\n${releaseNote}`
    )
  }

  return slackifyMarkdown(
    `[NEW PROD RELEASE](${releaseUrl}) 🚀🚀🚀 \n${releaseNote}`
  )
}

async function notifySlack(releaseUrl: string, rawReleaseNote: string) {
  // Shorten GitHub links
  let releaseNote = rawReleaseNote.replace(
    /(https:\/\/github\.com\/flagright\/orca\/pull\/)(\d+)/g,
    '[#$2]($1$2)'
  )
  // Add Notion ticket links to release notes

  const lines: string[] = releaseNote.split('\n')
  const customerFacingTickets: string[] = []
  const otherTickets: string[] = []
  const nonTicketLines: { index: number; line: string }[] = []

  await Promise.all(
    lines.map(async (line, index) => {
      const prNumber = line.match(/\[#(\d+)\]/)?.[1]
      if (!prNumber) {
        nonTicketLines.push({ index, line })
        return
      }

      const ticket = await getTicketInfoByPrNumber(prNumber)
      if (!ticket) {
        if (prNumber) {
          otherTickets.push(line)
          return
        } else {
          nonTicketLines.push({ index, line })
          return
        }
      }

      const ticketLink = `[${ticket.ticketId}](${ticket.url})`
      const updatedLine = `${line} (${ticketLink})`

      const page = await getNotionPageByTicketID(ticket.ticketId)
      const isCustomerFacing =
        (page.properties['Customer'] as any)?.multi_select.length !== 0
      if (isCustomerFacing) {
        customerFacingTickets.push(
          `* :amaze: ${updatedLine.replace(/^\*/, '')}`
        )
      } else {
        otherTickets.push(updatedLine)
      }
    })
  )

  const finalLines: string[] = []

  let ticketIndex = 0
  const allTickets = [...customerFacingTickets, ...otherTickets]

  for (let i = 0; i < lines.length; i++) {
    const nonTicketLine = nonTicketLines.find((nt) => nt.index === i)
    if (nonTicketLine) {
      finalLines.push(nonTicketLine.line)
    } else {
      finalLines.push(allTickets[ticketIndex++])
    }
  }
  releaseNote = finalLines.join('\n')

  for (const channel of Object.keys(CHANNELS) as (keyof typeof CHANNELS)[]) {
    const finalText = getFinalText(releaseUrl, releaseNote, channel)

    const lines = finalText.split('\n')
    const chunks: string[] = []
    let currentChunk = ''
    for (const line of lines) {
      if (currentChunk.length + line.length > 3000) {
        chunks.push(currentChunk)
        currentChunk = ''
      }
      currentChunk += `${line}\n`
    }

    if (currentChunk) {
      chunks.push(currentChunk)
    }

    await slackClient.chat.postMessage({
      channel: CHANNELS[channel],
      blocks: chunks.map((chunk) => ({
        type: 'section',
        text: { type: 'mrkdwn', text: chunk.trim() },
      })),
    })
  }
}

async function updateNotionTickets() {
  const headRefs = await getToBeReleasedHeadRefs()
  const notionTicketIds = headRefs
    .map(getNotionTicketIDByGitRef)
    .filter(Boolean) as string[]

  for (const ticketId of notionTicketIds) {
    await updateTicketStatusByID(ticketId, 'Done (Weekly)')
  }
}

async function main() {
  await updateNotionTickets()
  const { releaseUrl, releaseBody } = await createGitHubRelease()
  await notifySlack(releaseUrl, releaseBody)
  console.info(`Release: ${releaseUrl}\n${releaseBody}`)
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
