import {
  Engagement,
  Task,
  Note,
} from '@mergeapi/merge-sdk-typescript/dist/crm/models'
import { memoize } from 'lodash'
import { users } from './users'
import {
  CRM_ENGAGEMENTS_SEED,
  CRM_NOTES_SEED,
  CRM_TASKS_SEED,
  CRM_SUMMARY_SEED,
} from './seeds'
import { CrmSummary } from '@/@types/openapi-internal/CrmSummary'
import { RandomNumberGenerator } from '@/core/seed/samplers/prng'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'

const MAX_BRANCH_DEPTH = 5
const INITIAL_RFI_TOPICS = [
  {
    subject: 'Request for Additional Information – Unusual Transaction Review',
    content: `Hi [UserName],\n\nWe are conducting a standard review of transactions flagged for potential structuring. To comply with FinCEN guidelines, we kindly request the following:\n\n1. Source of funds for transactions on [DateRange]\n2. Identity verification for the transacting party\n3. Explanation for cash deposits exceeding $10,000\n\nPlease respond within 5 business days to avoid further escalation.\n\nKind regards,\n[AgentName]`,
  },
  {
    subject: 'Request for Beneficial Ownership Information',
    content: `Hi [UserName],\n\nAs part of our due diligence process, we require beneficial ownership details for the accounts linked to your entity. Kindly provide the following:\n\n1. Full list of beneficial owners\n2. Ownership percentage for each individual\n\nYour prompt response is required within 5 business days.\n\nBest regards,\n[AgentName]`,
  },
  {
    subject: 'Source of Funds Verification Request',
    content: `Hi [UserName],\n\nWe need clarification on the source of funds for recent large transactions involving your account. To complete our review, please provide supporting documentation for the following:\n\n1. Bank statements for the past 3 months\n2. Any legal documents supporting the source of funds\n\nPlease respond as soon as possible to avoid delays.\n\nKind regards,\n[AgentName]`,
  },
  {
    subject: 'OFAC Screening – Transaction Flags',
    content: `Hi [UserName],\n\nDuring our regular screening, several of your recent transactions were flagged by OFAC (Office of Foreign Assets Control). To ensure compliance, we need the following information:\n\n1. A detailed explanation of the flagged transactions\n2. Confirmation of whether any parties are included on the OFAC list\n\nPlease provide this information within 5 business days.\n\nBest regards,\n[AgentName]`,
  },
  {
    subject: 'PEP (Politically Exposed Persons) Verification Request',
    content: `Hi [UserName],\n\nAs part of our KYC and compliance procedures, we are reviewing your account for any connection to Politically Exposed Persons (PEPs). Kindly confirm the following:\n\n1. Whether any account holders are classified as PEPs\n2. Documentation supporting the status of each account holder\n\nWe require your response within 5 business days.\n\nKind regards,\n[AgentName]`,
  },
  {
    subject: 'Large Cash Transaction Review Request',
    content: `Hi [UserName],\n\nOur system flagged recent cash transactions exceeding $10,000 on your account. To comply with FinCEN's reporting requirements, please provide the following:\n\n1. Documentation explaining the purpose of the transactions\n2. Source of cash and any supporting bank statements\n\nWe would appreciate your prompt response.\n\nBest regards,\n[AgentName]`,
  },
  {
    subject: 'Suspicious Activity Report (SAR) Clarification Request',
    content: `Hi [UserName],\n\nA SAR was filed for activity on your account due to several irregular transactions. We require additional clarification for the following:\n\n1. Explanation for the flagged activity\n2. Any supporting evidence or documentation\n\nYour immediate response will help us resolve this matter.\n\nKind regards,\n[AgentName]`,
  },
  {
    subject: 'Cross-Border Transaction Review Request',
    content: `Hi [UserName],\n\nWe are reviewing cross-border transactions on your account for compliance with OFAC and AML guidelines. Kindly provide the following:\n\n1. Details of the recipient for the transactions\n2. Supporting documents proving the legitimacy of the transactions\n\nPlease respond within 5 business days.\n\nBest regards,\n[AgentName]`,
  },
  {
    subject: 'Request for Transaction Patterns and Explanation',
    content: `Hi [UserName],\n\nWe are conducting a review of your recent transaction patterns that have raised flags. Please provide the following:\n\n1. A detailed explanation of the recent activity\n2. Documentation supporting the source of funds and legitimacy of transactions\n\nWe require your response within 5 business days.\n\nKind regards,\n[AgentName]`,
  },
  {
    subject: 'High-Risk Jurisdiction Transaction Review',
    content: `Hi [UserName],\n\nOur system flagged several transactions involving high-risk jurisdictions. As part of our compliance check, please provide the following:\n\n1. Justification for sending funds to/from high-risk jurisdictions\n2. Any documentation proving the legitimacy of these transactions\n\nPlease respond promptly to avoid delays.\n\nBest regards,\n[AgentName]`,
  },
  {
    subject: 'AML Compliance – Customer Due Diligence (CDD) Review',
    content: `Hi [UserName],\n\nAs part of our AML program, we are conducting a Customer Due Diligence (CDD) review on your account. Please provide the following:\n\n1. Updated KYC documentation for the account holders\n2. Additional information regarding any corporate beneficiaries\n\nKindly provide the requested information within 5 business days.\n\nBest regards,\n[AgentName]`,
  },
  {
    subject: 'Wire Transfer Verification Request',
    content: `Hi [UserName],\n\nWe need to verify several large wire transfers from your account. Please provide the following:\n\n1. Bank statements for the past 6 months\n2. Documentation supporting the wire transfer purposes\n\nPlease respond within 5 business days to prevent any delays.\n\nKind regards,\n[AgentName]`,
  },
  {
    subject: 'Suspicious Transaction Flags – Request for Details',
    content: `Hi [UserName],\n\nSeveral recent transactions were flagged for suspicious activity. Please provide the following details:\n\n1. Explanation for the flagged transactions\n2. Source of funds supporting the transactions\n\nWe kindly request your prompt response to resolve this matter.\n\nBest regards,\n[AgentName]`,
  },
  {
    subject: 'Verification of Transaction Origin and Destination',
    content: `Hi [UserName],\n\nWe are reviewing transactions involving multiple accounts. Please provide the following:\n\n1. Detailed explanation of the origin and destination of funds\n2. Any supporting documents proving the transaction legitimacy\n\nYour response is required within 5 business days.\n\nBest regards,\n[AgentName]`,
  },
  {
    subject: 'Financial Crime Risk Management – Request for Information',
    content: `Hi [UserName],\n\nWe are conducting a review of your account as part of our financial crime risk management program. Please provide the following:\n\n1. Transaction records from the past 6 months\n2. Documentation supporting the legitimacy of high-value transactions\n\nWe appreciate your timely response.\n\nKind regards,\n[AgentName]`,
  },
  {
    subject: 'PEP Relationship Confirmation Request',
    content: `Hi [UserName],\n\nWe are currently conducting a review of your account for PEP (Politically Exposed Person) status. Please confirm the following:\n\n1. Whether you or any connected parties are classified as a PEP\n2. Documentation supporting your response\n\nPlease provide your reply within 5 business days.\n\nKind regards,\n[AgentName]`,
  },
  {
    subject: 'Review of High-Value Assets and Transactions',
    content: `Hi [UserName],\n\nWe are reviewing your account for high-value assets and transactions that may require additional documentation. Please provide the following:\n\n1. Proof of ownership for large transactions or assets\n2. Explanation for the purpose of recent high-value transactions\n\nWe kindly request your response within 5 business days.\n\nBest regards,\n[AgentName]`,
  },
  {
    subject: 'AML Transaction Review – Request for Details',
    content: `Hi [UserName],\n\nIn accordance with AML regulations, we are conducting a review of your account for potentially suspicious transactions. Kindly provide the following:\n\n1. Detailed explanation of recent flagged transactions\n2. Source of funds for large deposits\n\nWe need your response within 5 business days.\n\nBest regards,\n[AgentName]`,
  },
  {
    subject: 'Suspicious Deposit Activity – Request for Documentation',
    content: `Hi [UserName],\n\nWe have detected suspicious deposit activity on your account. To comply with regulatory requirements, we need the following:\n\n1. Transaction records for the past 30 days\n2. Proof of the source of the funds involved in the deposits\n\nPlease provide your response at the earliest convenience.\n\nKind regards,\n[AgentName]`,
  },
]
const CRM_AGENTS = [
  'Rachel Morgan – FinCrime Specialist',
  'Ethan Patel – AML Compliance Analyst',
  'Sophia Zhao – Risk & Intelligence Officer',
  'Daniel Reyes – Senior Investigator',
  'Liam Carter – Regulatory Affairs Manager',
  'Ava Thompson – Transaction Monitoring Analyst',
  'Noah Walker – KYC Compliance Officer',
  'Mia Rodriguez – Enhanced Due Diligence Analyst',
  'Logan Brooks – OFAC Review Officer',
  'Isabella Hughes – FinCEN Liaison Officer',
  'Benjamin Shah – PEP Review Analyst',
  'Olivia Jenkins – SAR Filing Specialist',
  'Elijah Murphy – Financial Crimes Investigator',
  'Emma Cooper – High-Risk Accounts Officer',
  'Lucas Adams – Cross-Border Transaction Analyst',
  'Grace Mitchell – Client Risk Evaluator',
  'Mason Hill – Watchlist Screening Analyst',
  'Chloe Simmons – Beneficial Ownership Auditor',
  'James Allen – Fraud Risk Manager',
  'Amelia Scott – Corporate Compliance Officer',
  'Alexander King – Transaction Pattern Analyst',
  'Ella Turner – Suspicious Activity Specialist',
  'Jacob Barnes – Wire Transfer Oversight Officer',
  'Sofia Green – CDD/KYC Review Analyst',
  'William Torres – AML Escalation Lead',
  'Harper Bennett – Risk Operations Associate',
  'Jack Ramirez – Regulatory Reporting Advisor',
  'Emily Nguyen – PEP Screening Coordinator',
  'Henry Flores – Transaction Documentation Reviewer',
  'Lily Campbell – Jurisdiction Risk Specialist',
]
const STATUSES = ['follow_up', 'escalation', 'schedule_call', 'closure']
const EMAIL_RESPONSES = {
  follow_up: [
    {
      subject: 'Reminder: Outstanding Documentation for FinCEN Inquiry',
      content:
        'Hello [UserName],\n\nThis is a gentle reminder to submit the requested ownership documents related to the recent FinCEN inquiry. Please let us know if you need assistance in gathering the required materials.\n\nBest,\n[AgentName]',
    },
    {
      subject: 'Second Follow-up: Clarification on Unusual Transactions',
      content:
        'Dear [UserName],\n\nWe have yet to receive a response regarding the recent series of transactions flagged for review. Kindly respond at your earliest convenience to avoid compliance delays.\n\nSincerely,\n[AgentName]',
    },
  ],
  escalation: [
    {
      subject: 'Urgent: FinCEN Escalation Notice',
      content:
        'Dear [UserName],\n\nDue to non-response on prior communications, we are escalating the case involving suspicious wire transfers dated {{date}}. This may result in a SAR filing. Immediate attention is required.\n\nRegards,\n[AgentName] (Escalation Officer)',
    },
    {
      subject: 'Immediate Action Required: Regulatory Disclosure Deadline',
      content:
        'Hi [UserName],\n\nThis is an escalation regarding the delayed documentation for your high-risk jurisdiction exposure. If we do not receive the required documents within 48 hours, we will proceed with regulatory reporting.\n\nRegards,\n[AgentName]',
    },
  ],
  closure: [
    {
      subject: 'Case Closed – Documentation Received',
      content:
        'Hello [UserName],\n\nThank you for submitting the requested documents. We have completed our review and no further action is required. Your cooperation is appreciated.\n\nKind regards,\n[AgentName]',
    },
    {
      subject: 'RFI Case Closure Confirmation',
      content:
        'Dear [UserName],\n\nThis email confirms the closure of the recent FinCEN RFI regarding transaction review. Should additional information be needed, we will reach out again.\n\nBest regards,\n[AgentName]',
    },
  ],
  schedule_call: [
    {
      subject: 'Scheduling a Call to Discuss RFI Response',
      content:
        'Hi [UserName],\n\nWe’d like to schedule a call to discuss your recent RFI submission and clarify a few outstanding items. Please share your availability for this week.\n\nThanks,\n[AgentName]',
    },
    {
      subject: 'Request for Call – Follow-Up on Regulatory Inquiry',
      content:
        'Hello [UserName],\n\nTo expedite the resolution of your case, we propose a short call to address remaining questions. Kindly let us know your preferred time slots.\n\nWarm regards,\n[AgentName]',
    },
  ],
}

const humanizeStatus = (status: string) => {
  return status.split('_').join(' ')
}

const getCrmAccountId = (
  user: InternalBusinessUser | InternalConsumerUser
): string | undefined => {
  return user.tags?.find((t) => t.key === 'crmAccountId')?.value
}

const getUserName = (
  user: InternalBusinessUser | InternalConsumerUser
): string | undefined => {
  if (user.type === 'CONSUMER') {
    const {
      lastName = '',
      firstName = '',
      middleName = '',
    } = user.userDetails?.name ?? {}
    return `${lastName} ${firstName}${middleName ? ` ${middleName}` : ''}`
  }
  return user.legalEntity.companyGeneralDetails.legalName
}

const getUserEmail = (
  user: InternalBusinessUser | InternalConsumerUser
): string | undefined => {
  if (user.type === 'CONSUMER') {
    const { contactDetails } = user
    return contactDetails?.emailIds?.[0]
  } else {
    const { legalEntity } = user
    return legalEntity.contactDetails?.emailIds?.[0]
  }
}

export const getEngagements: () => Engagement[] = memoize(() => {
  return users.flatMap((u, index) => {
    return generateCrmDataForUser(u, index).engagements
  })
})

export const getNotes: () => Note[] = memoize(() => {
  return users.flatMap((u, index) => {
    return generateCrmDataForUser(u, index).notes
  })
})

export const getTasks: () => Task[] = memoize(() => {
  return users.flatMap((u, index) => {
    return generateCrmDataForUser(u, index).tasks
  })
})

export const getSummaries: () => CrmSummary[] = memoize(() => {
  const rng = new RandomNumberGenerator(CRM_SUMMARY_SEED)

  return users.flatMap((u) => {
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
      sentiment: rng.randomInt(100),
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

const generateCrmDataForUser: (
  user: InternalBusinessUser | InternalConsumerUser,
  index: number
) => {
  engagements: Engagement[]
  notes: Note[]
  tasks: Task[]
} = memoize(
  (user: InternalBusinessUser | InternalConsumerUser, index: number) => {
    const crmAccountId = getCrmAccountId(user)
    const userName = getUserName(user)
    const userEmail = getUserEmail(user)
    if (!userEmail || !userName || !crmAccountId) {
      return {
        engagements: [] as Engagement[],
        notes: [] as Note[],
        tasks: [] as Task[],
      }
    }
    const rng = new RandomNumberGenerator(
      CRM_ENGAGEMENTS_SEED + CRM_NOTES_SEED + CRM_TASKS_SEED + index
    )
    let rfi: { subject: string; content: string } =
      rng.pickRandom(INITIAL_RFI_TOPICS)
    let status = 'initial'
    const engagements: Engagement[] = []
    const notes: Note[] = []
    const tasks: Task[] = []

    let timestamp = rng.randomTimestamp()
    let fromAgent = true
    let depth = 0

    while (depth < MAX_BRANCH_DEPTH) {
      if (!fromAgent) {
        // we will be mocking user action
        status = rng.pickRandom(STATUSES)
        rfi = rng.pickRandom(EMAIL_RESPONSES[status])
        fromAgent = !fromAgent
        continue
      }
      const crmAgent = rng.pickRandom(CRM_AGENTS)

      const from = crmAgent
      // Replace placeholders
      const content = rfi.content
        .replace('[AgentName]', from)
        .replace('[UserName]', userName)
        .replace('[DateRange]', '01/01/2022 to 01/31/2022')

      engagements.push({
        content,
        subject: rfi.subject,
        account: crmAccountId,
        owner: crmAgent,
        start_time: new Date(rng.r(2).randomTimestamp()),
        end_time: new Date(rng.r(3).randomTimestamp()),
        contacts: [userEmail],
      })

      // Attach note and task
      notes.push({
        content: `Note on ${humanizeStatus(status)} for ${crmAgent}`,
        account: crmAccountId,
        owner: userName,
        remote_created_at: new Date(
          rng.r(2).randomTimestamp(undefined, new Date(timestamp))
        ),
      })
      tasks.push({
        content: `Task on ${humanizeStatus(status)} for ${crmAgent}`,
        account: crmAccountId,
        owner: userName,
        completed_date: new Date(
          rng.r(2).randomTimestamp(undefined, new Date(timestamp))
        ),
      })

      if (status === 'closure') {
        break
      }
      timestamp = rng.r(2).randomTimestamp(undefined, new Date(timestamp))
      fromAgent = !fromAgent
      depth++
    }

    return { engagements, notes, tasks }
  }
)
