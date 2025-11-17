import React, { useReducer } from 'react';
import { WORKFLOW_BUILDER_STATE_REDUCER } from './helpers';
import ApprovalWorkflowBuilder from '.';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const statePair = useReducer(WORKFLOW_BUILDER_STATE_REDUCER, {
    roles: ['role1', 'role222222222222', 'role3'],
  });
  return (
    <>
      <UseCase title="ApprovalWorkflowBuilder example">
        <div style={{ height: 450 }}>
          <ApprovalWorkflowBuilder state={statePair} />
        </div>
      </UseCase>
    </>
  );
}
