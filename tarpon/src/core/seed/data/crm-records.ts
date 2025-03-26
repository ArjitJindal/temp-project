import { memoize } from 'lodash'
import {
  CrmRecordSampler,
  ConversationSampler,
  AttachmentSampler,
} from '../samplers/crm-record'
import { BaseSampler } from '../samplers/base'
import { CRM_RECORDS_SEED } from './seeds'
import { users } from './users'
import { NangoConversation } from '@/@types/openapi-internal/NangoConversation'
import { NangoAttachments } from '@/@types/openapi-internal/NangoAttachments'
import { CRMRecord } from '@/@types/openapi-internal/CRMRecord'
import { NangoTicket } from '@/@types/openapi-internal/NangoTicket'
import { CRMRecordLink } from '@/@types/openapi-internal/CRMRecordLink'

export const RECORD_COUNT = 500
export const CONVERSATION_COUNT = 3
export const ATTACHMENT_COUNT = 3

export class NangoRecordSampler extends BaseSampler<CRMRecord> {
  private crmRecordSampler: CrmRecordSampler
  private conversationSampler: ConversationSampler
  private attachmentSampler: AttachmentSampler

  constructor(seed: number) {
    super(seed)

    this.crmRecordSampler = new CrmRecordSampler(seed)
    this.conversationSampler = new ConversationSampler(seed)
    this.attachmentSampler = new AttachmentSampler(seed)
  }

  protected generateSample(): CRMRecord {
    const ticketId = this.counter
    this.counter++
    const created_at = this.rng.randomTimestamp()
    const conversations: NangoConversation[] = []
    const attachments: NangoAttachments[] = []

    const crmRecord = this.crmRecordSampler.getSample(undefined, [
      ticketId,
      created_at,
    ])

    for (let index = 0; index < CONVERSATION_COUNT; index++) {
      conversations.push(this.conversationSampler.getSample(undefined))
    }

    for (let index = 0; index < ATTACHMENT_COUNT; index++) {
      const attachment = this.attachmentSampler.getSample()
      attachments.push(attachment)
    }

    const fullCrmRecord: NangoTicket = {
      ...crmRecord.data.record,
      ...{ conversations: conversations },
      ...{ attachments: attachments },
    }

    return {
      timestamp: created_at,
      data: { record: fullCrmRecord, recordType: crmRecord.recordType },
      id: ticketId.toString(),
      crmName: crmRecord.crmName,
      recordType: crmRecord.recordType,
    }
  }
}

export const getCrmRecords = memoize((): CRMRecord[] => {
  const nangoRecordSampler = new NangoRecordSampler(CRM_RECORDS_SEED)
  const crmRecords: CRMRecord[] = []

  for (let index = 0; index < RECORD_COUNT; index++) {
    crmRecords.push(nangoRecordSampler.getSample(undefined))
  }

  return crmRecords
})

export class CRMUserRecordLinkSampler extends BaseSampler<CRMRecordLink[]> {
  constructor(seed: number) {
    super(seed)
  }

  protected generateSample(): CRMRecordLink[] {
    const usersData = users
    const records = getCrmRecords()
    const crmRecordLinks: CRMRecordLink[] = []
    for (const user of usersData) {
      const randomRecords = this.rng.randomSubsetOfSize(records, 4)
      for (const record of randomRecords) {
        const crmRecordLink: CRMRecordLink = {
          crmName: 'FRESHDESK',
          id: record.id,
          recordType: record.recordType,
          userId: user.userId,
          timestamp: record.timestamp,
        }
        crmRecordLinks.push(crmRecordLink)
      }
    }
    return crmRecordLinks
  }
}

export const getCrmUserRecordLinks = memoize((): CRMRecordLink[] => {
  const crmUserRecordLinkSampler = new CRMUserRecordLinkSampler(
    CRM_RECORDS_SEED
  )
  return crmUserRecordLinkSampler.getSample(undefined)
})
