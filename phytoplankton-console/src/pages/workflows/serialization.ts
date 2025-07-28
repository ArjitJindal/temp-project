import { uniq } from 'lodash';
import { WorkflowBuilderState } from '@/components/WorkflowBuilder/types';
import { CaseAlertWorkflowItem } from '@/utils/api/workflows';
import { notEmpty } from '@/utils/array';

import { FINAL_STATE } from '@/components/WorkflowBuilder/consts';

type WorkflowItemSerialized = Omit<
  CaseAlertWorkflowItem,
  'id' | 'version' | 'name' | 'workflowType' | 'autoClose'
>;

export function deserialize(workflowItem: WorkflowItemSerialized): WorkflowBuilderState {
  return {
    transitions: workflowItem.transitions ?? [],
    enabled: workflowItem.enabled,
  };
}

export function serialize(workflowBuilderState: WorkflowBuilderState): WorkflowItemSerialized {
  const statuses = uniq(
    workflowBuilderState.transitions
      .flatMap((t) => [t.fromStatus, t.outcome.status])
      .filter(notEmpty),
  );
  return {
    author: '', // TODO: add author
    statuses: statuses,
    enabled: workflowBuilderState.enabled,
    transitions: workflowBuilderState.transitions,
    statusAssignments: statuses.reduce((acc, status) => {
      if (status === FINAL_STATE) {
        return acc;
      }
      return {
        ...acc,
        [status]: 'not_implemented_yet',
      };
    }, {}),
    roleTransitions: [],
  };
}
