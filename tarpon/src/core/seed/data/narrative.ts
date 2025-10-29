import { v4 as uuid4 } from 'uuid'
import memoize from 'lodash/memoize'
import { NarrativeTemplate } from '@/@types/openapi-internal/NarrativeTemplate'

export const getNarrativeTemplates = memoize(() => {
  return [
    {
      name: 'Sanction Suspicion',
      description:
        '**Reason for Alert/Case**\n\n- Basis for Suspicion:\n\n- Associated Entities:\n\n**Investigation Findings**\n\n- Customer Profile:\n\n- Match Review:\n\n- Supporting Evidence:\n\n**Decision:**',
      id: uuid4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      name: 'AML/Fraud Suspicion',
      description:
        '**Reason for Alert/Case**\n\n- Basis for Suspicion:\n\n- Associated Transactions:\n\n**Investigation Findings**\n\n- Customer Profile:\n\n- Pattern Analysis:\n\n- Counterparty Risk:\n\n- Historical Behaviour:\n\n- Supporting Evidence:\n\n**Decision:**',
      id: uuid4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      name: 'Fincen',
      description: `# FinCEN SAR Narrative Template

## Suspicious Activity Report (SAR) Narrative

**Report Date:** [Insert Date]  
**Institution Name:** [Insert Financial Institution Name]  
**Case/Reference Number:** [Insert Internal Case Number]

---

### PART I: SUBJECT INFORMATION

**Subject Name:** [Full Legal Name]  
**Date of Birth:** [MM/DD/YYYY]  
**Address:** [Complete Address]  
**Identification Type & Number:** [e.g., Driver's License, Passport - Number]  
**Account Number(s):** [List all relevant account numbers]  
**Relationship to Institution:** [Customer, Employee, Third Party, etc.]

---

### PART II: SUSPICIOUS ACTIVITY SUMMARY

**Type of Suspicious Activity:** [Check all that apply]
- [ ] Structuring/Smurfing
- [ ] Money Laundering
- [ ] Terrorist Financing
- [ ] Fraud (specify type)
- [ ] Identity Theft
- [ ] Elder Financial Exploitation
- [ ] Cyber-Related Activity
- [ ] Other: [Specify]

**Date(s) of Suspicious Activity:** [Start Date] to [End Date]  
**Total Dollar Amount Involved:** $[Amount]

---

### PART III: DETAILED NARRATIVE

#### A. BACKGROUND AND ACCOUNT ACTIVITY

Provide context about the subject's relationship with the institution, account opening date, stated purpose of account, typical account behavior, and any previous alerts or concerns.

**Example:**
The subject opened a personal checking account on [date] with an initial deposit of $[amount]. The stated purpose of the account was [employment/business income/etc.]. The subject's account activity historically consisted of [describe normal patterns].

---

#### B. DESCRIPTION OF SUSPICIOUS ACTIVITY

Using the "Five Essential Elements" (Who, What, When, Where, Why):

**WHO:** Clearly identify all parties involved, including subjects, beneficiaries, and any third parties.

**WHAT:** Describe the specific transactions or activities that raised suspicion. Include:
- Transaction types (deposits, withdrawals, wire transfers, etc.)
- Dollar amounts
- Methods (cash, check, electronic, etc.)
- Frequency and patterns
- Any attempts to avoid reporting requirements

**WHEN:** Provide specific dates, times, and duration of the suspicious activity. Include timelines showing escalation or patterns.

**WHERE:** Identify all locations involved:
- Branch locations
- ATM locations
- Geographic areas of wire transfers
- IP addresses (for online activity)
- Foreign jurisdictions involved

**WHY:** Explain why this activity is suspicious. Include:
- Deviation from expected activity
- Lack of business justification
- Red flag indicators observed
- Comparison to peer/similar account behavior
- Customer explanation (if obtained) and why it's insufficient

---

#### C. SPECIFIC TRANSACTIONS AND PATTERNS

Detail the specific transactions chronologically:

**Transaction 1:**
- Date: [MM/DD/YYYY]
- Type: [Deposit/Withdrawal/Transfer]
- Amount: $[Amount]
- Method: [Cash/Check/Wire]
- Description: [Detailed description]
- Red Flag: [Why this was suspicious]

[Repeat for additional transactions]

**Pattern Analysis:**
Describe any patterns observed such as:
- Structured transactions just below reporting thresholds
- Rapid movement of funds
- Use of multiple accounts or individuals
- Inconsistency with customer profile
- Geographic anomalies

---

#### D. INVESTIGATION AND DUE DILIGENCE

Describe steps taken to investigate the activity:
- Review of transaction history
- Enhanced due diligence performed
- Open-source research conducted
- Customer contact attempts and responses
- Internal system checks
- Review of related accounts
- Consultation with law enforcement (if applicable)

**Customer Explanation (if obtained):**
[Include any explanation provided by the customer and analysis of why it was insufficient or inconsistent]

---

#### E. FINANCIAL IMPACT AND INSTITUTIONAL RISK

- Total amount of suspicious transactions: $[Amount]
- Estimated loss to institution (if applicable): $[Amount]
- Potential regulatory or reputational risk: [Description]
- Current status of account: [Active/Closed/Restricted]

---

#### F. LAW ENFORCEMENT NOTIFICATION

- [ ] Law enforcement has been notified
- [ ] Law enforcement has NOT been notified

**If notified:**
- Agency Name: [Name]
- Contact Person: [Name and Title]
- Date of Notification: [MM/DD/YYYY]
- Case Number (if provided): [Number]

---

#### G. ACTIONS TAKEN

Describe actions taken by the institution:
- Account restrictions or closures
- Transaction blocks
- Enhanced monitoring implemented
- Customer relationship terminated
- Funds held or seized
- Other: [Specify]

---

### PART IV: SUPPORTING DOCUMENTATION

List all documentation attached or available to support this SAR:
- [ ] Transaction records
- [ ] Account statements
- [ ] Wire transfer documentation
- [ ] Customer identification documents
- [ ] Communication records
- [ ] Surveillance footage/images
- [ ] Open-source research results
- [ ] Other: [Specify]

---

### PART V: PREPARER INFORMATION

**Prepared By:** [Name and Title]  
**Department:** [BSA/AML Compliance Department]  
**Contact Number:** [Phone]  
**Email:** [Email Address]  
**Date Prepared:** [MM/DD/YYYY]

**Reviewed By:** [Name and Title]  
**Date Reviewed:** [MM/DD/YYYY]

---

## NARRATIVE WRITING BEST PRACTICES

### Key Principles:
1. **Be Clear and Concise:** Use plain language, avoid jargon
2. **Be Specific:** Include dates, amounts, and factual details
3. **Be Objective:** Report facts, not opinions or conclusions
4. **Be Complete:** Answer who, what, when, where, and why
5. **Be Chronological:** Present events in logical order
6. **Be Relevant:** Include only pertinent information

### Common Pitfalls to Avoid:
- Vague descriptions ("large amount," "many transactions")
- Conclusory statements ("subject is laundering money")
- Incomplete timelines or missing dates
- Failure to explain why activity is suspicious
- Omitting customer explanations
- Including irrelevant personal information

### Red Flag Keywords to Consider:
- Structuring/splitting transactions
- No apparent business purpose
- Inconsistent with customer profile
- Reluctance to provide information
- Frequent cash transactions
- Rapid movement of funds
- Use of nominee accounts
- High-risk jurisdictions
- Attempts to avoid reporting requirements

---

**CONFIDENTIALITY NOTICE:** This SAR and the information contained herein is confidential and protected by 31 U.S.C. 5318(g)(2) and 31 CFR 1020.320(e). Unauthorized disclosure may result in civil and criminal penalties.`,
      id: uuid4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]
})

export const getNarrativeTemplate = (
  narrativeTemplateId: string
): NarrativeTemplate => {
  return getNarrativeTemplates().find(
    (nt) => nt.id === narrativeTemplateId
  ) as NarrativeTemplate
}
