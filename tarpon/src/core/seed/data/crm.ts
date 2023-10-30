import {
  Engagement,
  Task,
  Note,
} from '@mergeapi/merge-sdk-typescript/dist/crm/models'
import { memoize } from 'lodash'
import { getUsers as users } from './users'
import { CrmSummary } from '@/@types/openapi-internal/CrmSummary'
import { randomInt } from '@/core/seed/samplers/prng'
import { randomName } from '@/core/seed/samplers/dictionary'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'

const noteContent = [
  'Follow up with John about providing identity documentation',
  'Onboard CFO',
  'Missing documentation for main shareholders',
]

const taskContent = [
  'Follow up with John about providing identity documentation',
  'Onboard CFO',
  'Missing documentation for main shareholders',
]

const emails = [
  {
    content: `Hi John
Thanks for the recent upload, we'll process it and get back to you in 5 business days.
Kind regards,
`,
    subject: 'Received documentation',
  },
  {
    content: `Hi John\
I think my last email bounced - can you let me know if you receive this?
Kind regards,
`,
    subject: 'Just checking in',
  },
  {
    content: `Hi John,
We need a scan of passport from all your directors within the next few weeks please.
Kind regards,
`,
    subject: 'Identity documents required',
  },
]

export const getEngagements: () => Engagement[] = memoize(() => {
  return users().flatMap((u) => {
    if (u.type !== 'BUSINESS') {
      return []
    }
    const crmAccountId = u.tags?.find((t) => t.key === 'crmAccountId')?.value
    if (!crmAccountId) {
      return []
    }
    const data = emails.map((email) => {
      const websites = u.legalEntity.contactDetails?.websites
      let domain = 'google.com'
      if (websites) {
        domain = websites[0].replace('www.', '')
      }
      const owner = `${randomName()} ${randomName()}`
      return {
        content: `${email.content}${owner}`,
        subject: email.subject,
        account: crmAccountId,
        owner,
        start_time: new Date(sampleTimestamp()),
        end_time: new Date(sampleTimestamp()),
        contacts: ['john', 'sarah'].map((name) => `${name}@${domain}`),
      }
    })
    return data
  })
})

export const getNotes: () => Note[] = memoize(() => {
  return users().flatMap((u) => {
    if (u.type !== 'BUSINESS') {
      return []
    }
    const crmAccountId = u.tags?.find((t) => t.key === 'crmAccountId')?.value
    if (!crmAccountId) {
      return []
    }
    return noteContent.map((content) => {
      const owner = `${randomName()} ${randomName()}`
      return {
        content,
        account: crmAccountId,
        owner,
        remote_created_at: new Date(sampleTimestamp()),
      }
    })
  })
})

export const getTasks: () => Task[] = memoize(() => {
  return users().flatMap((u) => {
    if (u.type !== 'BUSINESS') {
      return []
    }
    const crmAccountId = u.tags?.find((t) => t.key === 'crmAccountId')?.value
    if (!crmAccountId) {
      return []
    }
    return taskContent.map((content) => {
      const owner = `${randomName()} ${randomName()}`
      return {
        content,
        account: crmAccountId,
        owner,
        completed_date: new Date(sampleTimestamp()),
      }
    })
  })
})

export const getSummaries: () => CrmSummary[] = memoize(() => {
  return users().flatMap((u) => {
    if (u.type !== 'BUSINESS') {
      return []
    }
    const crmAccountId = u.tags?.find((t) => t.key === 'crmAccountId')?.value
    if (!crmAccountId) {
      return []
    }
    return {
      accountId: crmAccountId,
      summary: `${u.legalEntity.companyGeneralDetails.legalName} is a technology and services company that provides member support solutions utilizing technology, engagement, and analytics. They are located in ${u.legalEntity.companyRegistrationDetails?.registrationCountry} with 5001-10000 employees and a revenue of $500M-1B.`,
      sentiment: randomInt(100),
      good: `${u.legalEntity.companyGeneralDetails.legalName} is regularly using the platform and has not missed a subscription payment`,
      neutral: `${u.legalEntity.companyGeneralDetails.legalName} has been active on the platform for 6 months`,
      bad: `They are being unresponsive to various emails related to documentation gathering`,
    }
  })
})
