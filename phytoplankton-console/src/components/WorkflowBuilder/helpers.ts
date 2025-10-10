import { Dispatch, useReducer } from 'react';
import { WorkflowBuilderAction, WorkflowBuilderState } from '@/components/WorkflowBuilder/types';
import { neverReturn } from '@/utils/lang';

export type WorkflowBuilderStatePair = [WorkflowBuilderState, Dispatch<WorkflowBuilderAction>];

export const WORKFLOW_BUILDER_STATE_REDUCER = (
  state: WorkflowBuilderState,
  action: WorkflowBuilderAction,
) => {
  if (action.type === 'LOAD_STATE') {
    return action.payload;
  }
  if (action.type === 'UPDATE_TRANSITION') {
    const { id, transition } = action.payload;
    return {
      ...state,
      transitions: state.transitions.map((t) => {
        return t.id === id ? { ...t, ...transition } : t;
      }),
    };
  }
  if (action.type === 'ADD_TRANSITION') {
    const { transition } = action.payload;
    return {
      ...state,
      transitions: [...state.transitions, transition],
    };
  }
  if (action.type === 'REMOVE_TRANSITION') {
    const { transitionId } = action.payload;
    return {
      ...state,
      transitions: state.transitions.filter((t) => t.id !== transitionId),
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
