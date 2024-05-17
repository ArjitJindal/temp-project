import {
  getNotionTicketIDByGitRef,
  updateTicketStatusByID,
} from './utils/notion'
import { getToBeReleasedHeadRefs } from './utils/git'

async function updateNotionTickets() {
  const headRefs = await getToBeReleasedHeadRefs()
  const notionTicketIds = headRefs
    .map(getNotionTicketIDByGitRef)
    .filter(Boolean) as string[]

  for (const ticketId of notionTicketIds) {
    await updateTicketStatusByID(ticketId, 'Ready to Test')
  }
}

async function main() {
  await updateNotionTickets()
  console.info('Done')
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
