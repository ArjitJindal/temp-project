import { memoize } from 'lodash'
import {
  CrmRecordSampler,
  ConversationSampler,
  AttachmentSampler,
} from '../samplers/crm-record'
import { BaseSampler } from '../samplers/base'
import { users } from './users'
import { NANGO_RECORDS_SEED } from './seeds'
import { NangoModels, NangoRecord } from '@/@types/nango'
import { CrmModelType } from '@/@types/openapi-internal/CrmModelType'
import { NangoConversation } from '@/@types/openapi-internal/NangoConversation'
import { NangoAttachments } from '@/@types/openapi-internal/NangoAttachments'

export const RECORD_COUNT = 2
export const CONVERSATION_COUNT = 3
export const ATTACHMENT_COUNT = 3

const MODEL_TYPE: CrmModelType[] = ['FreshDeskTicket']

export class NangoRecordSampler extends BaseSampler<NangoRecord> {
  private crmRecordSampler: CrmRecordSampler
  private conversationSampler: ConversationSampler
  private attachmentSampler: AttachmentSampler

  constructor(seed: number) {
    super(seed)

    this.crmRecordSampler = new CrmRecordSampler(seed)
    this.conversationSampler = new ConversationSampler(seed)
    this.attachmentSampler = new AttachmentSampler(seed)
  }

  protected generateSample(userEmail: string) {
    const ticketId = this.counter
    this.counter++
    const created_at = this.rng.randomTimestamp()
    const model = this.rng.pickRandom(MODEL_TYPE) as NangoModels
    const conversations: NangoConversation[] = []
    const attachments: NangoAttachments[] = []

    const crmRecord = this.crmRecordSampler.getSample(undefined, [
      ticketId,
      userEmail,
      created_at,
      model,
    ])

    for (let index = 0; index < CONVERSATION_COUNT; index++) {
      conversations.push(
        this.conversationSampler.getSample(undefined, userEmail)
      )
    }

    for (let index = 0; index < ATTACHMENT_COUNT; index++) {
      const attachment = this.attachmentSampler.getSample()
      attachments.push(attachment)
    }

    const fullCrmRecord = {
      ...crmRecord,
      ...{ conversations: conversations },
      ...{ attachments: attachments },
    }

    return {
      timestamp: created_at,
      data: fullCrmRecord,
      id: ticketId.toString(),
      model: model,
      email: userEmail,
    }
  }
}

export const getCrmRecords = memoize((): NangoRecord[] => {
  const nangoRecordSampler = new NangoRecordSampler(NANGO_RECORDS_SEED)
  const crmRecords: NangoRecord[] = []

  const userEmails: string[] = []
  for (const user of users) {
    if (user.type === 'CONSUMER') {
      const userEmail = user.contactDetails?.emailIds?.[0]
      if (userEmail) {
        userEmails.push(userEmail)
      }
    } else if (user.type === 'BUSINESS') {
      const userEmail = user.legalEntity?.contactDetails?.emailIds?.[0]
      if (userEmail) {
        userEmails.push(userEmail)
      }
    }
  }
  for (const email of userEmails) {
    if (!email) {
      continue
    }

    for (let index = 0; index < 2; index++) {
      crmRecords.push(nangoRecordSampler.getSample(undefined, email))
    }
  }
  return crmRecords
})
