import crypto from 'crypto'
import { Octokit } from '@octokit/core'
import { getSecretByName } from '@/utils/secrets-manager'

export const getQAEnvName = (qaNamePattern: string) => {
  return qaNamePattern.match(/(qa[a-zA-Z0-9]{5})(?![a-zA-Z0-9])/)?.[1]
}

export const getLiveQAEnvs = async () => {
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
    const hash = crypto.createHash('sha1')
    // NOTE: Adding '\n' is important to have the same value as using the bash command `| shasum`
    hash.update(pr.head.ref + '\n', 'utf-8')
    return `qa${hash.digest('hex').slice(0, 5)}`
  })

  return liveQaEnvs
}
