import { execSync } from 'child_process'
import { Octokit } from 'octokit'

const GITHUB_REPO = 'orca'
const GITHUB_OWNER = 'flagright'
const githubClient = new Octokit({ auth: process.env.GITHUB_TOKEN })

export async function getPullRequest(prNumber: string | number) {
  return githubClient.rest.pulls.get({
    pull_number: Number(prNumber),
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
  })
}

export async function createGitHubRelease(): Promise<{
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

export async function getToBeReleasedHeadRefs() {
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

  return await Promise.all(
    prNumbers.map(async (prNumber) => {
      const pr = await getPullRequest(prNumber)
      return pr.data.head.ref
    })
  )
}
