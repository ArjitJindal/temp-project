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
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'

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

const getCrmAccountId = (
  user: InternalBusinessUser | InternalConsumerUser
): string | undefined => {
  return user.tags?.find((t) => t.key === 'crmAccountId')?.value
}

const getUserName = (
  user: InternalBusinessUser | InternalConsumerUser
): string | undefined => {
  if (user.type === 'CONSUMER') {
    const { lastName, firstName, middleName } = user.userDetails?.name ?? {
      lastName: '',
      firstName: '',
      middleName: '',
    }
    return `${lastName} ${firstName}${middleName ? ` ${middleName}` : ''}`
  }
  return user.legalEntity.companyGeneralDetails.legalName
}

const getDomain = (
  user: InternalBusinessUser | InternalConsumerUser
): string => {
  if (user.type === 'BUSINESS') {
    const websites = user.legalEntity.contactDetails?.websites
    return websites ? websites[0].replace('www.', '') : 'example.com'
  }
  return 'gmail.com' // Default domain for CONSUMER users
}

export const getEngagements: () => Engagement[] = memoize(() => {
  return users().flatMap((u) => {
    const crmAccountId = getCrmAccountId(u)
    if (!crmAccountId) {
      return []
    }
    const domain = getDomain(u)
    return emails.map((email) => {
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
  })
})

export const getNotes: () => Note[] = memoize(() => {
  return users().flatMap((u) => {
    const crmAccountId = getCrmAccountId(u)
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
    const crmAccountId = getCrmAccountId(u)
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
    const crmAccountId = getCrmAccountId(u)
    if (!crmAccountId) {
      return []
    }
    const name = getUserName(u)
    const isConsumer = u.type === 'CONSUMER'
    return {
      accountId: crmAccountId,
      summary: isConsumer
        ? `${name} is a consumer user of our platform.`
        : `${name} is a technology and services company that provides member support solutions utilizing technology, engagement, and analytics. They are located in ${u.legalEntity.companyRegistrationDetails?.registrationCountry} with 5001-10000 employees and a revenue of $500M-1B.`,
      sentiment: randomInt(100),
      good: isConsumer
        ? `${name} has been a loyal customer for over a year.`
        : `${name} is regularly using the platform and has not missed a subscription payment`,
      neutral: isConsumer
        ? `${name} has moderate engagement with our services.`
        : `${name} has been active on the platform for 6 months`,
      bad: isConsumer
        ? `${name} has not responded to recent promotional emails.`
        : `They are being unresponsive to various emails related to documentation gathering`,
    }
  })
})
