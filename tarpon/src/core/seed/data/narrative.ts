import { v4 as uuid4 } from 'uuid'
import { memoize } from 'lodash'
import { NarrativeTemplate } from '@/@types/openapi-internal/NarrativeTemplate'

export const getNarrativeTemplates = memoize(() => {
  return [
    {
      name: 'Analysis of high risk transaction template',
      description:
        'Merchant is an [XXX], Card country and IP address status [], Typical transaction patterns []. Overall [XXX] fraud risk,  Assessment on RFI -> []',
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
