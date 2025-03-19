import { BaseSampler } from './base'
import { emailDomains } from './users'
import { CRMRecord } from '@/@types/openapi-internal/CRMRecord'
import { NangoConversation } from '@/@types/openapi-internal/NangoConversation'
import { NangoAttachments } from '@/@types/openapi-internal/NangoAttachments'

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
const TICKET_DESCRIPTIONS: { descriptionText?: string; subject?: string }[] = [
  {
    subject: 'Login Issue',
    descriptionText:
      'User reports being unable to log in despite entering the correct credentials. Password reset attempts also fail.',
  },
  {
    subject: 'Payment Failure',
    descriptionText:
      "Customer attempted to process payment via credit card but received an 'Invalid Transaction' error.",
  },
  {
    subject: 'Feature Request: Dark Mode',
    descriptionText:
      'User suggests adding a dark mode option for better usability during nighttime browsing.',
  },
  {
    subject: 'Bug: App Crashes on Startup',
    descriptionText:
      'Multiple users report that the mobile app crashes immediately upon launching after the latest update.',
  },
  {
    subject: 'Slow Website Performance',
    descriptionText:
      'Website takes longer than usual to load pages, especially on the checkout page.',
  },
  {
    subject: 'Email Notifications Not Received',
    descriptionText:
      'User has not been receiving order confirmation or support emails despite correct email settings.',
  },
  {
    subject: 'Request for Refund',
    descriptionText:
      'Customer mistakenly purchased the wrong plan and requests a refund per the 30-day money-back policy.',
  },
  {
    subject: 'Two-Factor Authentication Issue',
    descriptionText:
      'User enabled 2FA but is not receiving the authentication code on their registered device.',
  },
  {
    subject: 'Order Not Delivered',
    descriptionText:
      'Customer placed an order 10 days ago, but tracking information has not been updated, and the package has not arrived.',
  },
  {
    subject: 'Unable to Reset Password',
    descriptionText:
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
  protected generateSample([ticketId, userEmail, createdAt, model]): CRMRecord {
    return {
      model: model,
      data: {
        subject: this.rng.pickRandom(TICKET_DESCRIPTIONS).subject,
        fwdEmails: generateRandomEmails(),
        createdAt,
        replyCcEmails: generateRandomEmails(),
        priority: this.rng.randomInt(10),
        source: this.rng.randomInt(100),
        isEscalated: this.rng.randomBool(),
        email: userEmail,
        updatedAt: this.rng.randomTimestamp(),
        attachments: [],
        conversations: [],
        tags: [],
        descriptionText:
          TICKET_DESCRIPTIONS[this.rng.randomInt(TICKET_DESCRIPTIONS.length)]
            .descriptionText || ' ',
        responderId: this.rng.randomInt(1000000).toString(),
        requesterId: this.rng.randomInt(1000000).toString(),
        id: ticketId,
        ccEmails: generateRandomEmails(),
        toEmails: generateRandomEmails(),
        type: this.rng.pickRandom(TICKET_TYPES),
      },
    }
  }
}

export class ConversationSampler extends BaseSampler<NangoConversation> {
  protected generateSample(fromEmail: string): NangoConversation {
    const email = this.rng.pickRandom([
      fromEmail,
      '"Flagright " <support@flagright.freshdesk.com>',
    ])

    return {
      createdAt: this.rng.randomTimestamp(),
      toEmail: generateRandomEmails()[0],
      fromEmail: email,
      updatedAt: this.rng.randomTimestamp(),
      bodyText: generateRandomEmailBody(),
      ccEmails: generateRandomEmails(),
    }
  }
}

export class AttachmentSampler extends BaseSampler<NangoAttachments> {
  protected generateSample(): NangoAttachments {
    return {
      attachmentUrl: 'https://www.flagright.com/',
      contentType: this.rng.pickRandom(ATTACHMENT_CONTENT_TYPES),
      size: this.rng.randomInt(400000),
      updatedAt: this.rng.randomTimestamp(),
      name: this.rng.pickRandom(ATTACHMENT_NAMES),
      id: this.rng.randomInt(10000),
    }
  }
}
