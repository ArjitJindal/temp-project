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
const DEPLOYMENT_CHANNEL_ID = 'C03L5KRE2E8'

const githubClient = new Octokit({ auth: process.env.GITHUB_TOKEN })
const slackClient = new WebClient(process.env.SLACK_TOKEN)

async function createGitHubRelease(): Promise<{
  releaseUrl: string
  releaseBody: string
}> {
  const latestCommit = execSync('git rev-parse HEAD').toString().trim()
  const release = execSync('git rev-parse --short=7 HEAD').toString().trim()
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

async function notifySlack(releaseUrl: string, rawReleaseNote: string) {
  const releaseNote = rawReleaseNote.replace(
    /(https:\/\/github\.com\/flagright\/orca\/pull\/)(\d+)/g,
    '[#$2]($1$2)'
  )
  await slackClient.chat.postMessage({
    channel: DEPLOYMENT_CHANNEL_ID,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: slackifyMarkdown(
            `[NEW PROD RELEASE](${releaseUrl}) 🚀🚀🚀 \n${releaseNote}`
          ),
        },
      },
    ],
  })
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
