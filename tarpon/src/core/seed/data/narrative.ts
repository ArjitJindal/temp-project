import { v4 as uuid4 } from 'uuid'
import { memoize } from 'lodash'
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
  ]
})

export const getNarrativeTemplate = (
  narrativeTemplateId: string
): NarrativeTemplate => {
  return getNarrativeTemplates().find(
    (nt) => nt.id === narrativeTemplateId
  ) as NarrativeTemplate
}
