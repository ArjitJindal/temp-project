import { uniq } from 'lodash';
import { WorkflowBuilderState } from '@/components/WorkflowBuilder/types';
import { WorkflowItem } from '@/utils/api/workflows';
import { notEmpty } from '@/utils/array';

import { FINAL_STATE } from '@/components/WorkflowBuilder/consts';

type WorkflowItemSerialized = Omit<
  WorkflowItem,
  'id' | 'version' | 'name' | 'workflowType' | 'autoClose'
>;

export function deserialize(workflowItem: WorkflowItemSerialized): WorkflowBuilderState {
  return {
    transitions: workflowItem.transitions ?? [],
  };
}

export function serialize(workflowBuilderState: WorkflowBuilderState): WorkflowItemSerialized {
  const statuses = uniq(
    workflowBuilderState.transitions
      .flatMap((t) => [t.fromStatus, t.outcome.status])
      .filter(notEmpty),
  );
  return {
    statuses: statuses,
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
