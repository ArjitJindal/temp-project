import type {
  FreshDeskTicket,
  NangoSync,
  ProxyConfiguration,
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
    const tickets: FreshDeskTicket[] = await Promise.all(
      freshdeskTicket.map(async (ticket) => {
        const getTicket = await nango.get({
          endpoint: `/api/v2/tickets/${ticket.id}?include=conversations`,
          retries: 10,
        })

        const ticketData = getTicket.data as FreshdeskApiTicket

        const ticketSchema: FreshDeskTicket = {
          created_at: new Date(ticket.created_at).valueOf(),
          updated_at: new Date(ticket.updated_at).valueOf(),
          is_escalated: ticket.is_escalated,
          priority: ticket.priority,
          requester_id: ticket.requester_id,
          responder_id: ticket.responder_id,
          source: ticket.source,
          subject: ticket.subject,
          to_emails: ticket.to_emails,
          id: ticket.id.toString(),
          type: ticket.type,
          cc_emails: ticket.cc_emails,
          fwd_emails: ticket.fwd_emails,
          reply_cc_emails: ticket.reply_cc_emails,
          tags: ticket.tags,
          email: ticket.requester.email,
          description_text: ticketData.description_text,
          conversations:
            ticketData.conversations?.map((conversation) => ({
              body_text: conversation.body_text || null,
              from_email: conversation.from_email || null,
              to_email: conversation.to_email || null,
              created_at:
                conversation.created_at !== null
                  ? new Date(conversation.created_at).valueOf()
                  : null,
              updated_at:
                conversation.updated_at !== null
                  ? new Date(conversation.updated_at).valueOf()
                  : null,
            })) || [],
          attachments:
            ticketData.attachments?.map((attachment) => ({
              content_type: attachment.content_type,
              size: attachment.size,
              updated_at: attachment.updated_at,
              name: attachment.name,
              id: attachment.id,
              attachment_url: attachment.attachment_url,
            })) || [],
        }

        return ticketSchema
      })
    )

    await nango.batchSave(tickets, 'FreshDeskTicket')
  }
}
