import {
  getNotionTicketIDByGitRef,
  updateTicketStatusByID,
  updateTicketURLByID,
} from './utils/notion'

const type = process.argv[2] as 'create' | 'merge'
const branchName = process.env.BRANCH_NAME as string
const prUrl = process.env.PR_URL as string

if (!branchName) {
  throw new Error('BRANCH_NAME is not set')
}

async function main() {
  const ticketId = getNotionTicketIDByGitRef(branchName)
  if (!ticketId) {
    console.info('No ticket ID found')
    return
  }

  if (type === 'create') {
    await updateTicketStatusByID(ticketId, 'In Review')
    await updateTicketURLByID(ticketId, prUrl)
  } else if (type === 'merge') {
    await updateTicketStatusByID(ticketId, 'Ready to Deploy')
  } else {
    throw new Error(`Invalid type ${type}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
