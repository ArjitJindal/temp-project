import { WorkflowItem, WorkflowType } from '@/utils/api/workflows';

export type Template = {
  id: string;
  description: string;
  item: Omit<WorkflowItem, 'id' | 'version'>;
};

export const TEMPLATE_GROUPS: {
  title: string;
  description: string;
  type: WorkflowType;
  templates: Template[];
}[] = [
  {
    title: 'Case investigation',
    description:
      'Select from the existing templates of case investigation to setup workflow at case management.',
    type: 'case',
    templates: [
      {
        id: 'test1',
        description: 'Set up an case investigation workflow that has only a checker.',
        item: {
          workflowType: 'case',
          name: 'Checker',
          statuses: ['OPEN', 'CLOSED'],
          statusAssignments: {
            OPEN: 'not_implemented_yet',
          },
          transitions: [
            {
              id: 'cfd3f6ba-d6a1-4467-a709-be8b5b61077c',
              fromStatus: 'OPEN',
              condition: {
                action: 'CLOSE',
              },
              outcome: {
                status: 'CLOSED',
              },
            },
          ],
          roleTransitions: [],
          // autoClose: false,
        },
      },
      {
        id: 'test2',
        description:
          'Set up an case investigation workflow with one checker that escalates to escalation maker.',
        item: {
          workflowType: 'case',
          name: 'Checker and escalation maker',
          statuses: ['OPEN', 'ESCALATED', 'CLOSED'],
          statusAssignments: {
            OPEN: 'not_implemented_yet',
            ESCALATED: 'not_implemented_yet',
          },
          transitions: [
            {
              id: '9d8f4763-896a-450c-b2b2-57af80c9bb14',
              fromStatus: 'OPEN',
              condition: {
                action: 'ESCALATE',
              },
              outcome: {
                status: 'ESCALATED',
              },
            },
            {
              id: '40e2ec80-5450-4da1-8051-8ea63a2ed4e6',
              fromStatus: 'ESCALATED',
              condition: {
                action: 'CLOSE',
              },
              outcome: {
                status: 'CLOSED',
              },
            },
            {
              id: '1012de7f-24b0-4fe6-b772-8e1f02752d7d',
              fromStatus: 'ESCALATED',
              condition: {
                action: 'REOPEN',
              },
              outcome: {
                status: 'OPEN',
              },
            },
          ],
          roleTransitions: [],
          // autoClose: false,
        },
      },
    ],
  },
];
