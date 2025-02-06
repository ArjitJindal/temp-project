import { BaseSampler } from './base'
import { emailDomains } from './users'
import { CRMRecord } from '@/@types/openapi-internal/CRMRecord'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { FreshdeskTicketAttachment } from '@/@types/openapi-internal/FreshdeskTicketAttachment'
import { FreshdeskTicketConversation } from '@/@types/openapi-internal/FreshdeskTicketConversation'

const TICKET_TYPES = ['RESISTANT', 'COMPLIANCE', 'OTHER']

const ATTACHMENT_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

const ATTACHMENT_NAMES = [
  'invoice.pdf',
  'invoice.docx',
  'invoice.doc',
  'invoice.xls',
  'invoice.xlsx',
  'invoice.ppt',
  'invoice.pptx',
]
const TICKET_DESCRIPTIONS: { description_text?: string; subject?: string }[] = [
  {
    subject: 'Login Issue',
    description_text:
      'User reports being unable to log in despite entering the correct credentials. Password reset attempts also fail.',
  },
  {
    subject: 'Payment Failure',
    description_text:
      "Customer attempted to process payment via credit card but received an 'Invalid Transaction' error.",
  },
  {
    subject: 'Feature Request: Dark Mode',
    description_text:
      'User suggests adding a dark mode option for better usability during nighttime browsing.',
  },
  {
    subject: 'Bug: App Crashes on Startup',
    description_text:
      'Multiple users report that the mobile app crashes immediately upon launching after the latest update.',
  },
  {
    subject: 'Slow Website Performance',
    description_text:
      'Website takes longer than usual to load pages, especially on the checkout page.',
  },
  {
    subject: 'Email Notifications Not Received',
    description_text:
      'User has not been receiving order confirmation or support emails despite correct email settings.',
  },
  {
    subject: 'Request for Refund',
    description_text:
      'Customer mistakenly purchased the wrong plan and requests a refund per the 30-day money-back policy.',
  },
  {
    subject: 'Two-Factor Authentication Issue',
    description_text:
      'User enabled 2FA but is not receiving the authentication code on their registered device.',
  },
  {
    subject: 'Order Not Delivered',
    description_text:
      'Customer placed an order 10 days ago, but tracking information has not been updated, and the package has not arrived.',
  },
  {
    subject: 'Unable to Reset Password',
    description_text:
      'User reports that the password reset link sent via email does not work and redirects to a blank page.',
  },
]

export const generateRandomName = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length)
    result += chars[randomIndex]
  }
  return result
}

export const generateRandomEmails = () => {
  return [
    ...new Set(
      Array.from({ length: (3 + Math.random()) | 0 }).map(
        () =>
          `${generateRandomName()}@${
            emailDomains[(Math.random() * emailDomains.length) | 0]
          }`
      )
    ),
  ]
}

export const generateRandomEmailBody = () => {
  const words =
    'update meeting invoice purchase confirm reminder response offer request issue details review schedule account payment urgent customer support subscription opportunity refund delay inquiry follow-up statement assistance transaction notice verification approval billing adjustment deadline notification agreement discussion report service renewal security compliance changes availability clarification guideline confirmation feedback announcement contract resolution access documentation summary alert provision credentials process email notice correspondence terms negotiation assessment proposal registration activation inquiry assistance escalation processing settlement authorization balance communication instructions eligibility processing consultation guidance adjustment validation tracking reference identification retrieval inquiry coordination evaluation assignment record information enforcement submission priority assessment exception procedure arrangement engagement formulation integration adaptation preparation consultation approval coordination validation notification'.split(
      ' '
    )

  return `Hi,\n\n${Array.from(
    { length: 30 },
    () => words[(Math.random() * words.length) | 0]
  ).join(' ')}.\n\nBest,\nCompany`
}

export class CrmRecordSampler extends BaseSampler<
  Omit<CRMRecord, 'conversations' | 'attachments'>
> {
  protected generateSample([ticketId, userEmail, created_at, model]) {
    return {
      model: model,
      subject: this.rng.pickRandom(TICKET_DESCRIPTIONS).subject,
      fwd_emails: generateRandomEmails(),
      created_at: created_at,
      timestamp: this.sampleTimestamp(),
      reply_cc_emails: generateRandomEmails(),
      priority: this.rng.randomInt(10),
      source: this.rng.randomInt(100),
      is_escalated: this.rng.randomBool(),
      email: userEmail,
      updated_at: this.rng.randomTimestamp(),
      PartitionKeyId: DynamoDbKeys.NANGO_RECORD(
        'flagright-test',
        model,
        ticketId
      ).PartitionKeyID,
      description_text:
        TICKET_DESCRIPTIONS[this.rng.randomInt(TICKET_DESCRIPTIONS.length)]
          .description_text || ' ',
      responder_id: this.rng.randomInt(1000000),
      requester_id: this.rng.randomInt(1000000),
      id: ticketId,
      cc_emails: generateRandomEmails(),
      Sort_Key_id: ticketId,
      to_emails: generateRandomEmails(),
      type: this.rng.pickRandom(TICKET_TYPES),
    }
  }
}

export class ConversationSampler extends BaseSampler<FreshdeskTicketConversation> {
  protected generateSample([from_email]) {
    const email = this.rng.pickRandom([
      from_email,
      '"Flagright " <support@flagright.freshdesk.com>',
    ])

    return {
      created_at: this.rng.randomTimestamp(),
      to_email: generateRandomEmails()[0],
      from_email: email,
      updated_at: this.rng.randomTimestamp().toString(),
      body_text: generateRandomEmailBody(),
      cc_emails: generateRandomEmails(),
    }
  }
}

export class AttachmentSampler extends BaseSampler<FreshdeskTicketAttachment> {
  protected generateSample() {
    return {
      content_type: this.rng.pickRandom(ATTACHMENT_CONTENT_TYPES),
      size: this.rng.randomInt(400000),
      updated_at: this.rng.randomTimestamp().toString(),
      name: this.rng.pickRandom(ATTACHMENT_NAMES),
      created_at: this.rng.randomTimestamp().toString(),
      id: this.rng.randomInt(10000),
      attachment_url: 'https://www.flagright.com/',
    }
  }
}
