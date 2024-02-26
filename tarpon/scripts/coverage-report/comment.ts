import { GitHub } from '@actions/github/lib/utils'

const MARKER = '<!-- This comment was produced by coverage-diff-action -->'

async function addComment(
  octokit: InstanceType<typeof GitHub>,
  repo: any,
  issue_number: number,
  body: string
): Promise<void> {
  await octokit.rest.issues.createComment({
    ...repo,
    issue_number,
    body: `${body}\n${MARKER}`,
  })
}

async function deleteExistingComments(
  octokit: InstanceType<typeof GitHub>,
  repo: any,
  issue_number: number
): Promise<void> {
  const comments = await octokit.rest.issues.listComments({
    ...repo,
    issue_number,
  })

  for (const comment of comments.data) {
    if (comment.body?.includes(MARKER)) {
      await octokit.rest.issues.deleteComment({
        ...repo,
        comment_id: comment.id,
      })
    }
  }
}

export { addComment, deleteExistingComments }
