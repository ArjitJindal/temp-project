import { NodeDescription } from './NodeCanvas/types';
import { Data as RoleNodeData } from './components/nodes/RoleNodeComponent';
import { Data as TerminalNodeData } from './components/nodes/TerminalNodeComponent';
import { Data as NewRoleButtonNodeData } from './components/nodes/NewRoleButtonNodeComponent';

/*
  Supported nodes
 */
export type RoleNode = NodeDescription<'ROLE', RoleNodeData>;
export type TerminalNode = NodeDescription<'TERMINAL', TerminalNodeData>;
export type NewRoleButtonNode = NodeDescription<'NEW_ROLE_BUTTON', NewRoleButtonNodeData>;
export type ApprovalWorkflowNode = RoleNode | TerminalNode | NewRoleButtonNode;

/*
  Reducer actions
 */
export type LoadStateAction = {
  type: 'LOAD_STATE';
  payload: WorkflowBuilderState;
};

export type AddRoleAction = {
  type: 'ADD_ROLE';
  payload: {
    afterRole: string | null;
    role: string;
  };
};

export type ReplaceRoleAction = {
  type: 'REPLACE_ROLE';
  payload: {
    oldRole: string;
    newRole: string;
  };
};

export type DeleteRoleAction = {
  type: 'DELETE_ROLE';
  payload: {
    role: string;
  };
};

export type WorkflowBuilderState = {
  roles: string[];
};

export type WorkflowBuilderAction =
  | LoadStateAction
  | AddRoleAction
  | ReplaceRoleAction
  | DeleteRoleAction;
