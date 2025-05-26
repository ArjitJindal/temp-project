import {
  AlertWorkflow,
  AlertWorkflowWorkflowTypeEnum,
  CaseWorkflow,
  CaseWorkflowWorkflowTypeEnum,
} from '@/apis';

export type WorkflowItem = CaseWorkflow | AlertWorkflow;

export type WorkflowType = CaseWorkflowWorkflowTypeEnum | AlertWorkflowWorkflowTypeEnum;

export function parseWorkflowType(type: unknown): WorkflowType {
  if (type === 'alert') {
    return 'alert';
  } else if (type === 'case') {
    return 'case';
  } else {
    throw new Error(`Invalid workflow type ${type}`);
  }
}
