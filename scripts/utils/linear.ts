import { Issue, LinearClient } from '@linear/sdk'

const linearClient = new LinearClient({
  apiKey: process.env.LINEAR_TOKEN,
})

const LINEAR_TICKET_ID_REGEX = /FDT-(\d+)/

function getLinearTicketNumber(ticketId: string): number | null {
  return Number(ticketId.match(LINEAR_TICKET_ID_REGEX)?.[1])
}

export function getLinearTicketIDByGitRef(gitRef: string): string | undefined {
  return gitRef.match(LINEAR_TICKET_ID_REGEX)?.[0]
}

export async function getLinearTicketByID(ticketID: string): Promise<Issue> {
  const ticketNumber = getLinearTicketNumber(ticketID)
  if (!ticketNumber) {
    throw new Error(`Invalid ticket ID ${ticketID}`)
  }

  const linearTicket = await linearClient.issue(`FDT-${ticketNumber}`)

  return linearTicket
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
  const linearTicket = await getLinearTicketByID(ticketId)
  const statuses = await linearClient.workflowStates({})
  const foundStatus = statuses.nodes.find(
    (s) => s.name.toLowerCase() === status.toLowerCase()
  )
  if (!foundStatus) {
    throw new Error(`Status ${status} not found`)
  }
  if (!linearTicket.id) {
    throw new Error(`Ticket ${ticketId} not found`)
  }
  console.info(`Updating ticket ${linearTicket.id} to status ${status}`)

  await linearClient.updateIssue(linearTicket.id, {
    stateId: foundStatus.id,
  })
  console.info(`Ticket '${ticketId}' updated to '${status}' status`)
}
