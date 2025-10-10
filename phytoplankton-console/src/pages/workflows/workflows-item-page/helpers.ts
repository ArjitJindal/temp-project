import { Dispatch, useReducer } from 'react';
import { AsyncResource, init, map } from '@/utils/asyncResource';
import { WorkflowBuilderAction, WorkflowBuilderState } from '@/components/WorkflowBuilder/types';
import { WORKFLOW_BUILDER_STATE_REDUCER } from '@/components/WorkflowBuilder/helpers';

type LoadAsyncResourceAction = {
  type: 'LOAD_ASYNC_RESOURCE';
  payload: AsyncResource<WorkflowBuilderState>;
};

export function useReducerWrapper(
  initialValue?: AsyncResource<WorkflowBuilderState>,
): [
  AsyncResource<WorkflowBuilderState>,
  Dispatch<WorkflowBuilderAction | LoadAsyncResourceAction>,
] {
  return useReducer(
    (
      state: AsyncResource<WorkflowBuilderState>,
      action: WorkflowBuilderAction | LoadAsyncResourceAction,
    ) => {
      if (action.type === 'LOAD_ASYNC_RESOURCE') {
        return action.payload;
      }
      return map(state, (state) => {
        return WORKFLOW_BUILDER_STATE_REDUCER(state, action);
      });
    },
    initialValue ?? init<WorkflowBuilderState>(),
  );
}
