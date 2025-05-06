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
    subject: 'Request for Suspicious Transaction Review',
    descriptionText:
      'Compliance team requests analysis of a $25,000 wire transfer to an offshore account flagged by the monitoring system.',
  },
  {
    subject: 'Unusual Activity Alert on Customer Account',
    descriptionText:
      'Customer account shows multiple high-value international transactions within a short timeframe. Requesting internal review.',
  },
  {
    subject: 'RFI: Clarification on Beneficial Ownership',
    descriptionText:
      'Need confirmation of the ultimate beneficial owner for corporate account 84293 used in multiple flagged transactions.',
  },
  {
    subject: 'Escalation: Potential Structuring Behavior',
    descriptionText:
      'Customer appears to be making cash deposits just under the reporting threshold across different branches. Please investigate.',
  },
  {
    subject: 'Investigation Request: Link to Sanctioned Entity',
    descriptionText:
      'System flagged a transaction possibly linked to an entity under OFAC sanctions. RFI raised for further assessment.',
  },
  {
    subject: 'SAR Justification Required',
    descriptionText:
      'Need justification for filing a SAR on account 56289. Please attach relevant transaction patterns or customer behavior analysis.',
  },
  {
    subject: 'High-Risk Jurisdiction Wire Transfer',
    descriptionText:
      'Compliance seeks additional context on a large outbound transfer to a high-risk jurisdiction. RFI initiated for business rationale.',
  },
  {
    subject: 'Multiple RFIs for Same Customer ID',
    descriptionText:
      'Customer 119202 has triggered 3 RFIs in the past month. Need a consolidated summary of findings and recommended actions.',
  },
  {
    subject: 'Unexplained Cash Activity',
    descriptionText:
      'RFI raised for unexplained frequent cash withdrawals exceeding $10,000 from ATM over two weeks. Review requested.',
  },
  {
    subject: 'Potential Identity Mismatch Detected',
    descriptionText:
      'A transaction was flagged due to mismatched KYC information. Need verification of customer identity documents and onboarding logs.',
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
  protected generateSample([ticketId, createdAt]): CRMRecord {
    return {
      recordType: 'TICKET',
      crmName: 'FRESHDESK',
      data: {
        record: {
          subject: this.rng.pickRandom(TICKET_DESCRIPTIONS).subject,
          fwdEmails: generateRandomEmails(),
          createdAt,
          replyCcEmails: generateRandomEmails(),
          priority: this.rng.randomInt(10),
          source: this.rng.randomInt(100),
          isEscalated: this.rng.randomBool(),
          email: generateRandomEmails()[0],
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
        recordType: 'TICKET',
      },
      id: ticketId,
      timestamp: createdAt,
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
