import { Dispatch, useReducer } from 'react';
import { WorkflowBuilderAction, WorkflowBuilderState } from './types';
import { neverReturn } from '@/utils/lang';

export type WorkflowBuilderStatePair = [WorkflowBuilderState, Dispatch<WorkflowBuilderAction>];

export const WORKFLOW_BUILDER_STATE_REDUCER = (
  state: WorkflowBuilderState,
  action: WorkflowBuilderAction,
): WorkflowBuilderState => {
  if (action.type === 'LOAD_STATE') {
    return action.payload;
  }
  if (action.type === 'ADD_ROLE') {
    const filteredRoles = state.roles.filter((x) => x !== action.payload.role);
    const index =
      action.payload.afterRole == null ? 0 : filteredRoles.indexOf(action.payload.afterRole) + 1;
    return {
      ...state,
      roles: filteredRoles.toSpliced(index, 0, action.payload.role),
    };
  }
  if (action.type === 'REPLACE_ROLE') {
    return {
      ...state,
      roles: state.roles.map((role) => {
        return role === action.payload.oldRole ? action.payload.newRole : role;
      }),
    };
  }
  if (action.type === 'DELETE_ROLE') {
    return {
      ...state,
      roles: state.roles.filter((role) => {
        return role !== action.payload.role;
      }),
    };
  }
  return neverReturn(action, state);
};

export function useWorkflowBuilderReducer(
  initialState: WorkflowBuilderState,
): WorkflowBuilderStatePair {
  const stateAndDispatch = useReducer(WORKFLOW_BUILDER_STATE_REDUCER, initialState);
  return stateAndDispatch;
}
