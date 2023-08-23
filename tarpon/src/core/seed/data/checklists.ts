import { v4 as uuid4 } from 'uuid'
import { ChecklistTemplate } from '@/@types/openapi-internal/ChecklistTemplate'

const checklistTemplates: ChecklistTemplate[] = []

export const getChecklistTemplate = (
  checklistTemplateId: string
): ChecklistTemplate => {
  return checklistTemplates.find(
    (clt) => clt.id === checklistTemplateId
  ) as ChecklistTemplate
}

const initChecklistTemplate = () => {
  if (checklistTemplates.length > 0) {
    return
  }
  checklistTemplates.push({
    id: uuid4(),
    name: 'First checklist template',
    description: 'First checklist template',
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
        name: 'RFI (optional)',
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
  })
}

export { initChecklistTemplate, checklistTemplates }
