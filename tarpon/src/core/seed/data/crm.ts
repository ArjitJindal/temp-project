import {
  Engagement,
  Task,
  Note,
} from '@mergeapi/merge-sdk-typescript/dist/crm/models'
import { data as users } from './users'
import { CrmSummary } from '@/@types/openapi-internal/CrmSummary'
import { randomInt } from '@/utils/prng'
import { randomName } from '@/core/seed/samplers/dictionary'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'

const engagements: Engagement[] = []
const notes: Note[] = []
const tasks: Task[] = []

const summaries: CrmSummary[] = []

const init = () => {
  users.forEach((u) => {
    if (u.type !== 'BUSINESS') {
      return
    }
    const crmAccountId = u.tags?.find((t) => t.key === 'crmAccountId')?.value
    if (!crmAccountId) {
      return
    }
    emails.forEach((email) => {
      const websites = u.legalEntity.contactDetails?.websites
      let domain = 'google.com'
      if (websites) {
        domain = websites[0].replace('www.', '')
      }
      const owner = `${randomName()} ${randomName()}`
      engagements.push({
        content: `${email.content}${owner}`,
        subject: email.subject,
        account: crmAccountId,
        owner,
        start_time: new Date(sampleTimestamp()),
        end_time: new Date(sampleTimestamp()),
        contacts: ['john', 'sarah'].map((name) => `${name}@${domain}`),
      })
    })
    noteContent.forEach((content) => {
      notes.push({
        content: content,
        account: crmAccountId,
        owner: `${randomName()} ${randomName()}`,
        remote_created_at: new Date(sampleTimestamp()),
      })
    })
    taskContent.forEach((content) => {
      tasks.push({
        content: content,
        account: crmAccountId,
        owner: `${randomName()} ${randomName()}`,
        completed_date: new Date(sampleTimestamp()),
      })
    })
    summaries.push({
      accountId: crmAccountId,
      summary: `${u.legalEntity.companyGeneralDetails.legalName} is a technology and services company that provides member support solutions utilizing technology, engagement, and analytics. They are located in ${u.legalEntity.companyRegistrationDetails?.registrationCountry} with 5001-10000 employees and a revenue of $500M-1B.`,
      sentiment: randomInt(undefined, 100),
      good: `${u.legalEntity.companyGeneralDetails.legalName} is regularly using the platform and has not missed a subscription payment`,
      neutral: `${u.legalEntity.companyGeneralDetails.legalName} has been active on the platform for 6 months`,
      bad: `They are being unresponsive to various emails related to documentation gathering`,
    })
  })
  return
}

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
    subject: 'Identity Documents Required',
  },
]

export { init, engagements, notes, tasks, summaries }
