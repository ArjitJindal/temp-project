import { Octokit } from 'octokit'
import { execSync } from 'child_process'
import { WebClient } from '@slack/web-api'
import {
  getNotionTicketIDByGitRef,
  updateTicketStatusByID,
} from './utils/notion'

const slackifyMarkdown = require('slackify-markdown')

const GITHUB_REPO = 'orca'
const GITHUB_OWNER = 'flagright'

const CHANNELS = {
  PRODUCT_RELEASE: 'C05MPLSLQKC',
  DEPLOYMENT: 'C03L5KRE2E8',
} as const

const githubClient = new Octokit({ auth: process.env.GITHUB_TOKEN })
const slackClient = new WebClient(process.env.SLACK_TOKEN)

async function createGitHubRelease(): Promise<{
  releaseUrl: string
  releaseBody: string
}> {
  const latestCommit = execSync('git rev-parse HEAD').toString().trim()
  const release = execSync('git rev-parse --short=7 HEAD').toString().trim()
  try {
    const existingRelease = await githubClient.rest.repos.getReleaseByTag({
      repo: GITHUB_REPO,
      owner: GITHUB_OWNER,
      tag: release,
    })
    return {
      releaseUrl: existingRelease.data.html_url,
      releaseBody: existingRelease.data.body ?? 'Unknown',
    }
  } catch (e) {
    // No release found
  }
  const releaseResult = await githubClient.rest.repos.createRelease({
    repo: GITHUB_REPO,
    owner: GITHUB_OWNER,
    target_commitish: latestCommit,
    tag_name: release,
    generate_release_notes: true,
  })
  return {
    releaseUrl: releaseResult.data.html_url,
    releaseBody: releaseResult.data.body ?? 'Unknown',
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
  const releaseNote = rawReleaseNote.replace(
    /(https:\/\/github\.com\/flagright\/orca\/pull\/)(\d+)/g,
    '[#$2]($1$2)'
  )

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
  const lastRelease = execSync(
    'git describe --abbrev=0 --tags `git rev-list --tags --max-count=1`'
  )
    .toString()
    .trim()
  const prNumbers = execSync(
    `git log --oneline ${lastRelease}..HEAD | grep -oE '\(#[0-9]+\)' | sed 's/[^0-9]*//g'`
  )
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean)

  const headRefs = await Promise.all(
    prNumbers.map(async (prNumber) => {
      const pr = await githubClient.rest.pulls.get({
        pull_number: Number(prNumber),
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
      })
      return pr.data.head.ref
    })
  )
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
