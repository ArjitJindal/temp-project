import { Issue, LinearClient } from '@linear/sdk'

const linearClient = new LinearClient({ apiKey: process.env.LINEAR_TOKEN })

const LINEAR_TICKET_ID_REGEX_1 = /FDT-(\d+)/
const LINEAR_TICKET_ID_REGEX_2 = /fdt-(\d+)/

function getLinearTicketNumber(ticketId: string): number | null {
  return Number(ticketId.match(LINEAR_TICKET_ID_REGEX_1)?.[1])
}

export function getLinearTicketIDByGitRef(gitRef: string): string | undefined {
  const match1 = gitRef.match(LINEAR_TICKET_ID_REGEX_1)
  const match2 = gitRef.match(LINEAR_TICKET_ID_REGEX_2)
  if (match1) {
    return match1[0].toUpperCase()
  }
  if (match2) {
    return match2[0].toUpperCase()
  }
  return undefined
}

export async function getLinearTicketByID(ticketID: string): Promise<Issue> {
  const ticketNumber = getLinearTicketNumber(ticketID)
  if (!ticketNumber) {
    throw new Error(`Invalid ticket ID ${ticketID}`)
  }

  const linearTicket = await linearClient.issue(`FDT-${ticketNumber}`)

  return linearTicket
}

export enum TicketStatus {
  InProgress = 'In Progress',
  InReview = 'In Review',
  ReadyToDeploy = 'Ready to Deploy',
  ReadyToTest = 'Ready to Test',
  DoneWeekly = 'Done (Weekly)',
  QaFail = 'QA Fail',
}

export async function updateTicketStatusByID(
  ticketId: string,
  status: TicketStatus,
  ifStatusIgnore?: TicketStatus[]
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

  if (ifStatusIgnore?.includes(status)) {
    console.info(`Skipping ticket ${ticketId} update to status ${status}`)
    return
  }

  await linearClient.updateIssue(linearTicket.id, {
    stateId: foundStatus.id,
  })
  console.info(`Ticket '${ticketId}' updated to '${status}' status`)
}

export async function isIssueCustomerFacing(issue: Issue) {
  const customerNeeds = await linearClient.customerNeeds({
    filter: {
      issue: {
        id: {
          in: [issue.id],
        },
      },
    },
  })

  return customerNeeds.nodes.length > 0
}
