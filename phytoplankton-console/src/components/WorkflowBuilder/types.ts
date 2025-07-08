export type Transition = {
  id: string;
  fromStatus: string;
  condition: {
    action: string;
  };
  outcome: {
    status?: string;
    assignee?: string;
  };
};

export type WorkflowBuilderState = {
  transitions: Transition[];
  enabled: boolean;
};

export type LoadStateAction = {
  type: 'LOAD_STATE';
  payload: WorkflowBuilderState;
};

export type AddTransitionAction = {
  type: 'ADD_TRANSITION';
  payload: {
    transition: Transition;
  };
};

export type UpdateTransitionAction = {
  type: 'UPDATE_TRANSITION';
  payload: {
    id: string;
    transition: Partial<Transition>;
  };
};

export type RemoveTransitionAction = {
  type: 'REMOVE_TRANSITION';
  payload: {
    transitionId: string;
  };
};

export type WorkflowBuilderAction =
  | LoadStateAction
  | AddTransitionAction
  | RemoveTransitionAction
  | UpdateTransitionAction;
