import type {
  Ticket,
  NangoSync,
  ProxyConfiguration,
  FreshdeskTicket,
} from '../../models'

export interface FreshdeskApiTicket {
  cc_emails: string[]
  company_id: number
  custom_fields: Record<string, any>
  deleted: boolean
  due_by: string
  email: string
  email_config_id: number
  facebook_id: string
  fr_due_by: string
  fr_escalated: boolean
  fwd_emails: string[]
  group_id: number
  id: number
  is_escalated: boolean
  name: string
  phone: string
  priority: number
  product_id: number
  reply_cc_emails: string[]
  requester_id: number
  responder_id: number
  source: number
  status: number
  subject: string
  tags: string[]
  spam: boolean
  to_emails: string[]
  twitter_id: string
  type: string
  created_at: number
  updated_at: number
  requester: {
    email: string
  }
}

export interface FreshdeskApiTicket {
  description: string | null
  description_text: string | null
  conversations: Conversation[] | null
  attachments: Attachments[] | null
}

export interface Conversation {
  body: string | null
  body_text: string | null
  from_email: string | null
  to_email: string | null
  created_at: number | null
  updated_at: number | null
  cc_emails: string[] | null
}

export interface Attachments {
  content_type: string
  size: number
  updated_at: string
  name: string
  id: number
  attachment_url: string
}

export default async function fetchData(nango: NangoSync): Promise<void> {
  const config: ProxyConfiguration = {
    endpoint: '/api/v2/tickets?include=requester',
    retries: 10,
    paginate: {
      type: 'link',
      limit_name_in_request: 'per_page',
      link_rel_in_response_header: 'next',
    },
  }

  if (nango.lastSyncDate) {
    config.params = {
      updated_since: nango.lastSyncDate.toISOString(),
    }
  }

  for await (const freshdeskTicket of nango.paginate<FreshdeskApiTicket>(
    config
  )) {
    const tickets: Ticket[] = await Promise.all(
      freshdeskTicket.map(async (ticket) => {
        const getTicket = await nango.get({
          endpoint: `/api/v2/tickets/${ticket.id}?include=conversations`,
          retries: 10,
        })

        const ticketData = getTicket.data as FreshdeskApiTicket

        const ticketSchema: FreshdeskTicket = {
          createdAt: new Date(ticket.created_at).valueOf(),
          updatedAt: new Date(ticket.updated_at).valueOf(),
          isEscalated: ticket.is_escalated,
          priority: ticket.priority,
          requesterId: ticket?.requester_id
            ? ticket.requester_id.toString()
            : null,
          responderId: ticket?.responder_id
            ? ticket.responder_id.toString()
            : null,
          source: ticket.source,
          subject: ticket.subject,
          toEmails: ticket.to_emails,
          id: ticket.id.toString(),
          type: ticket.type,
          ccEmails: ticket.cc_emails,
          fwdEmails: ticket.fwd_emails,
          replyCcEmails: ticket.reply_cc_emails,
          tags: ticket.tags,
          email: ticket.requester.email,
          descriptionText: ticketData.description_text,
          conversations:
            ticketData.conversations?.map((conversation) => ({
              bodyText: conversation.body_text || null,
              fromEmail: conversation.from_email || null,
              toEmail: conversation.to_email || null,
              ccEmails: conversation.cc_emails || null,
              createdAt:
                conversation.created_at !== null
                  ? new Date(conversation.created_at).valueOf()
                  : null,
              updatedAt:
                conversation.updated_at !== null
                  ? new Date(conversation.updated_at).valueOf()
                  : null,
            })) || [],
          attachments:
            ticketData.attachments?.map((attachment) => ({
              contentType: attachment.content_type,
              size: attachment.size,
              updatedAt: new Date(attachment.updated_at).valueOf(),
              name: attachment.name,
              id: attachment.id,
              attachmentUrl: attachment.attachment_url,
            })) || [],
        }

        return ticketSchema
      })
    )

    await nango.batchSave(tickets, 'FreshdeskTicket')
  }
}
