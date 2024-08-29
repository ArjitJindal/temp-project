import { Client } from '@notionhq/client'
import { DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints'

const NOTION_DATABASE_ID = '16d55dfca8e2436c9c7786ab7c62e04e'
const notionClient = new Client({ auth: process.env.NOTION_TOKEN })

const NOTION_TICKET_ID_REGEX = /FR-(\d+)/

function getNotionTicketNumber(ticketId: string): number | null {
  return Number(ticketId.match(NOTION_TICKET_ID_REGEX)?.[1])
}

export function getNotionTicketIDByGitRef(gitRef: string): string | undefined {
  return gitRef.match(NOTION_TICKET_ID_REGEX)?.[0]
}

export async function getNotionPageByTicketID(
  ticketID: string
): Promise<DatabaseObjectResponse> {
  const ticketNumber = getNotionTicketNumber(ticketID)
  if (!ticketNumber) {
    throw new Error(`Invalid ticket ID ${ticketID}`)
  }
  const ticket = await notionClient.databases.query({
    database_id: NOTION_DATABASE_ID,
    filter: {
      and: [
        {
          property: 'ID',
          unique_id: { equals: ticketNumber },
        },
      ],
    },
  })
  return ticket.results[0] as DatabaseObjectResponse
}

export async function updateTicketStatusByID(
  ticketId: string,
  status:
    | 'In Progress'
    | 'In Review'
    | 'Ready to Deploy'
    | 'Ready to Test'
    | 'Done (Weekly)'
) {
  const page = await getNotionPageByTicketID(ticketId)
  if (!page.id) {
    throw new Error(`Ticket ${ticketId} not found`)
  }
  await notionClient.pages.update({
    page_id: page.id,
    properties: {
      Status: { type: 'status', status: { name: status } },
    },
  })
  console.info(`Ticket '${ticketId}' updated to '${status}' status`)
}

export async function updateTicketURLByID(ticketId: string, url: string) {
  const page = await getNotionPageByTicketID(ticketId)
  if (!page.id) {
    throw new Error(`Ticket ${ticketId} not found`)
  }
  await notionClient.pages.update({
    page_id: page.id,
    properties: {
      URL: { type: 'url', url },
    },
  })
  console.info(`Ticket '${ticketId}' updated with URL '${url}'`)
}
