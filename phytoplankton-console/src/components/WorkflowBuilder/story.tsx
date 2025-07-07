import React, { useReducer } from 'react';
import WorkflowBuilder from '.';
import { UseCase } from '@/pages/storybook/components';
import { WORKFLOW_BUILDER_STATE_REDUCER } from '@/components/WorkflowBuilder/helpers';
import { FINAL_STATE, START_STATE } from '@/components/WorkflowBuilder/consts';

export default function (): JSX.Element {
  const statePair = useReducer(WORKFLOW_BUILDER_STATE_REDUCER, {
    enabled: true,
    transitions: [
      {
        id: '1',
        fromStatus: START_STATE,
        condition: {
          action: 'TO_REVIEW',
        },
        outcome: {
          status: 'IN_REVIEW',
          assignee: 'mock-role-1',
        },
      },
      {
        id: '2',
        fromStatus: 'IN_REVIEW',
        condition: {
          action: 'CLOSE',
        },
        outcome: {
          status: FINAL_STATE,
          assignee: 'mock-role-2',
        },
      },
      {
        id: '3',
        fromStatus: 'IN_REVIEW',
        condition: {
          action: 'REOPEN',
        },
        outcome: {
          status: 'OPEN',
          assignee: 'mock-role-3',
        },
      },
      {
        id: '4',
        fromStatus: 'OPEN',
        condition: {
          action: 'CLOSE',
        },
        outcome: {
          status: FINAL_STATE,
          assignee: 'mock-role-1',
        },
      },
    ],
  });
  return (
    <>
      <UseCase title="WorkflowBuilder">
        <div style={{ height: 450 }}>
          <WorkflowBuilder workflowType={'alert'} state={statePair} />
        </div>
      </UseCase>
    </>
  );
}
