import { v4 as uuid4 } from 'uuid'
import memoize from 'lodash/memoize'
import { ChecklistTemplate } from '@/@types/openapi-internal/ChecklistTemplate'

export const getChecklistTemplates = memoize(() => {
  return [
    {
      id: uuid4(),
      name: 'Velocity alert checklist',
      description: 'Velocity alert checklist',
      status: 'ACTIVE',
      categories: [
        {
          name: 'Narrative',
          checklistItems: [
            {
              id: uuid4(),
              name: "Merchant's information is mentioned",
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'What rule triggered an alert',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Alert was negated',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Correct decision statement in the narrative',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Adverse media file are current',
              level: 'P1',
            },
          ],
        },
        {
          name: 'Documentation',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Case properly assigned to analyst',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Correct reason selected',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Files are properly named',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Proper Google search performed for company',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'All necessary files are included',
              level: 'P1',
            },
          ],
        },
        {
          name: 'Technical',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Final decision',
              level: 'P1',
            },
          ],
        },
        {
          name: 'RFI',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Correct location of internal investigation files',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Necessary files present',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Correct date and client ID',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Correct information about the client',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Correct reason of investigation',
              level: 'P1',
            },
          ],
        },
      ],
    },
    {
      id: uuid4(),
      name: 'Suspicious Activity Investigation Checklist',
      description:
        'Comprehensive checklist for investigating suspicious activity alerts',
      status: 'ACTIVE',
      categories: [
        {
          name: 'Initial Assessment',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Alert severity and risk level assessed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Customer profile and KYC information reviewed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Transaction patterns and frequency analyzed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Geographic risk factors considered',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Time-based analysis completed',
              level: 'P2',
            },
          ],
        },
        {
          name: 'Customer Investigation',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Customer identification documents verified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Beneficial ownership structure analyzed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Customer risk rating updated if necessary',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'PEP status and adverse media checked',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Customer relationship history reviewed',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Source of funds documentation obtained',
              level: 'P1',
            },
          ],
        },
        {
          name: 'Transaction Analysis',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Transaction counterparties identified and verified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Transaction purpose and business justification documented',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Unusual transaction patterns identified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Cross-border transaction compliance verified',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Transaction velocity and frequency patterns analyzed',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Cash transaction thresholds reviewed',
              level: 'P1',
            },
          ],
        },
        {
          name: 'External Research',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Adverse media search conducted',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Sanctions lists checked',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Regulatory databases searched',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Industry-specific risk factors considered',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Public records and court filings reviewed',
              level: 'P3',
            },
          ],
        },
        {
          name: 'Documentation and Reporting',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Investigation narrative completed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Supporting documentation attached',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Risk assessment conclusion documented',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Recommendation for further action provided',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'SAR filing determination made',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Case closure documentation completed',
              level: 'P2',
            },
          ],
        },
      ],
    },
    {
      id: uuid4(),
      name: 'Money Laundering Investigation Checklist',
      description: 'Specialized checklist for money laundering investigations',
      status: 'ACTIVE',
      categories: [
        {
          name: 'Placement Analysis',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Cash deposits and unusual cash patterns identified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Structuring patterns analyzed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Third-party deposits and transfers reviewed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Currency exchange patterns examined',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'High-risk geographic origins identified',
              level: 'P1',
            },
          ],
        },
        {
          name: 'Layering Analysis',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Complex transaction chains mapped',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Shell company involvement identified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Offshore account connections analyzed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Nominee and beneficial ownership structures reviewed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Transaction velocity and frequency patterns examined',
              level: 'P2',
            },
          ],
        },
        {
          name: 'Integration Analysis',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Asset purchases and investments traced',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Business investments and acquisitions reviewed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Luxury goods and high-value purchases analyzed',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Real estate transactions examined',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Integration into legitimate economy assessed',
              level: 'P1',
            },
          ],
        },
        {
          name: 'Red Flag Indicators',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Unusual transaction amounts and patterns flagged',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Rapid movement of funds between accounts analyzed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Transactions inconsistent with customer profile reviewed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Use of multiple accounts or entities identified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Circular transactions and round-trip transfers detected',
              level: 'P1',
            },
          ],
        },
      ],
    },
    {
      id: uuid4(),
      name: 'Fraud Investigation Checklist',
      description: 'Comprehensive checklist for fraud-related investigations',
      status: 'ACTIVE',
      categories: [
        {
          name: 'Fraud Type Identification',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Identity theft indicators assessed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Account takeover patterns analyzed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Payment fraud schemes identified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Synthetic identity fraud indicators reviewed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Business email compromise (BEC) patterns examined',
              level: 'P1',
            },
          ],
        },
        {
          name: 'Evidence Collection',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Transaction logs and audit trails preserved',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Communication records collected',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Device and IP address information gathered',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Biometric and authentication data reviewed',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Third-party service provider data obtained',
              level: 'P2',
            },
          ],
        },
        {
          name: 'Customer Impact Assessment',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Financial loss amount calculated',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Customer notification requirements determined',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Regulatory reporting obligations assessed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Recovery and remediation options evaluated',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Customer protection measures implemented',
              level: 'P1',
            },
          ],
        },
        {
          name: 'Law Enforcement Coordination',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Internal security team notified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Law enforcement contact established if required',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Evidence preservation procedures followed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Legal counsel consulted',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Regulatory authorities notified if required',
              level: 'P1',
            },
          ],
        },
      ],
    },
    {
      id: uuid4(),
      name: 'Sanctions Screening Investigation Checklist',
      description:
        'Checklist for sanctions and watchlist screening investigations',
      status: 'ACTIVE',
      categories: [
        {
          name: 'Initial Screening',
          checklistItems: [
            {
              id: uuid4(),
              name: 'OFAC SDN list match verified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'EU sanctions list checked',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'UN Security Council sanctions reviewed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Local jurisdiction sanctions lists searched',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'PEP lists and databases checked',
              level: 'P1',
            },
          ],
        },
        {
          name: 'Match Verification',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Name matching algorithm results reviewed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Date of birth and other identifiers verified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Address and location information cross-referenced',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'False positive analysis completed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Additional verification sources consulted',
              level: 'P2',
            },
          ],
        },
        {
          name: 'Risk Assessment',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Sanctions risk level determined',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Business relationship impact assessed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Regulatory compliance requirements identified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Blocking and freezing requirements evaluated',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Reporting obligations determined',
              level: 'P1',
            },
          ],
        },
        {
          name: 'Documentation and Reporting',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Screening results documented',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Decision rationale recorded',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Regulatory reports filed if required',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Internal escalation procedures followed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Ongoing monitoring requirements established',
              level: 'P2',
            },
          ],
        },
      ],
    },
    {
      id: uuid4(),
      name: 'Customer Due Diligence Investigation Checklist',
      description:
        'Comprehensive CDD investigation checklist for enhanced due diligence',
      status: 'ACTIVE',
      categories: [
        {
          name: 'Customer Information Verification',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Identity documents verified and authenticated',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Address verification completed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Date of birth and nationality confirmed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Contact information validated',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Employment and income verification obtained',
              level: 'P1',
            },
          ],
        },
        {
          name: 'Beneficial Ownership Analysis',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Ultimate beneficial owners identified',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Ownership structure mapped and documented',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Control and influence relationships analyzed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Beneficial owner identity verification completed',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Ongoing monitoring of ownership changes established',
              level: 'P2',
            },
          ],
        },
        {
          name: 'Business Nature and Purpose',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Business activities and operations described',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Expected transaction patterns documented',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Geographic presence and operations mapped',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Customer base and suppliers identified',
              level: 'P2',
            },
            {
              id: uuid4(),
              name: 'Regulatory licenses and permits verified',
              level: 'P1',
            },
          ],
        },
        {
          name: 'Risk Assessment and Monitoring',
          checklistItems: [
            {
              id: uuid4(),
              name: 'Customer risk rating assigned',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Enhanced due diligence requirements determined',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Ongoing monitoring frequency established',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Review triggers and escalation procedures defined',
              level: 'P1',
            },
            {
              id: uuid4(),
              name: 'Documentation retention requirements established',
              level: 'P2',
            },
          ],
        },
      ],
    },
  ]
})

export const getChecklistTemplate = (
  checklistTemplateId: string
): ChecklistTemplate => {
  return getChecklistTemplates().find(
    (clt) => clt.id === checklistTemplateId
  ) as ChecklistTemplate
}
