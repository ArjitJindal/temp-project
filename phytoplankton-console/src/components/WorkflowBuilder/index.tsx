import { v4 as uuidv4 } from 'uuid';
import { uniq } from 'lodash';
import { useMemo, useState } from 'react';
import NodeCanvas from './NodeCanvas';
import { EdgeDescription, NodeDescription } from './NodeCanvas/types';

import s from './styles.module.less';

import TransitionDrawer, { FormValues } from './TransitionDrawer';
import { WorkflowBuilderStatePair } from '@/components/WorkflowBuilder/helpers';
import {
  AddTransitionAction,
  Transition,
  WorkflowBuilderState,
} from '@/components/WorkflowBuilder/types';
import { notEmpty } from '@/utils/array';
import { FINAL_STATE, START_STATE } from '@/components/WorkflowBuilder/consts';
import { WorkflowType } from '@/hooks/api/workflows';

const AVAILABLE_STATUSES = [
  START_STATE,
  'REOPENED',
  'ESCALATED',
  'IN_REVIEW',
  'IN_PROGRESS',
  'ON_HOLD',
  'ESCALATED_L2',
  FINAL_STATE,
];

const AVAILABLE_ACTIONS = ['REOPEN', 'ESCALATE', 'ESCALATE_L2', 'TO_REVIEW', 'CLOSE'];

type Props = {
  workflowType: WorkflowType;
  state: WorkflowBuilderStatePair;
};

export default function WorkflowBuilder(props: Props) {
  const { workflowType } = props;
  const [state, dispatch] = props.state;

  const { nodes, edges } = useMemo(() => getNodesAndEdges(state), [state]);
  const [selectedTransition, setSelectedTransition] = useState<Transition | null>();
  const [newTransition, setNewTransition] = useState<Pick<
    Transition,
    'id' | 'fromStatus'
  > | null>();

  const handleEditTransitionDrawerSubmit = (values: FormValues) => {
    if (selectedTransition) {
      dispatch({
        type: 'UPDATE_TRANSITION',
        payload: {
          id: selectedTransition.id,
          transition: {
            condition: {
              action: values.condition.action,
            },
            outcome: {
              status: values.outcome.status,
              assignee: values.outcome.assignee,
            },
          },
        },
      });
    }
  };

  const handleNewTransitionDrawerSubmit = (values: FormValues) => {
    if (newTransition) {
      const action: AddTransitionAction = {
        type: 'ADD_TRANSITION' as const,
        payload: {
          transition: {
            ...newTransition,
            condition: {
              action: values.condition.action,
            },
            outcome: {
              status: values.outcome.status,
              assignee: values.outcome.assignee,
            },
          },
        },
      };
      dispatch(action);
    }
  };

  const transitionsFormValidators = [
    (formValues) => {
      if (selectedTransition == null) {
        return null;
      }
      if (formValues.condition.action === selectedTransition.condition.action) {
        return null;
      }
      const sameActionTransitions = state.transitions.filter((transition) => {
        if (transition.id === selectedTransition.id) {
          return false;
        }
        if (transition.fromStatus !== selectedTransition.fromStatus) {
          return false;
        }
        return transition.condition.action === formValues.condition.action;
      });
      return sameActionTransitions.length > 0
        ? 'There is already a transition with the same action for this status'
        : null;
    },
  ];
  return (
    <div className={s.root}>
      <NodeCanvas
        nodes={nodes}
        edges={edges}
        onNodeClick={(node) => {
          if (node.type === 'TRANSITION') {
            const transitionNode = node as NodeDescription<'TRANSITION'>;
            const transition = state.transitions.find((transition) => {
              return transitionNode.data.transitionId === transition.id;
            });
            if (transition) {
              setSelectedTransition(transition);
            }
          } else if (node.type === 'NEW_BRANCH_BUTTON') {
            const newBranchButtonNode = node as NodeDescription<'NEW_BRANCH_BUTTON'>;
            setNewTransition({
              id: uuidv4(),
              fromStatus: newBranchButtonNode.data.fromStatus,
            });
          }
        }}
      />
      <TransitionDrawer
        availableStatuses={AVAILABLE_STATUSES}
        disabledStatuses={selectedTransition ? [selectedTransition.fromStatus] : []}
        availableActions={AVAILABLE_ACTIONS}
        workflowType={workflowType}
        isVisible={selectedTransition != null}
        initialValues={{
          condition: {
            action: selectedTransition?.condition.action ?? '',
          },
          outcome: {
            status: selectedTransition?.outcome.status ?? '',
            assignee: selectedTransition?.outcome.assignee ?? '',
          },
        }}
        onChangeVisibility={(isVisible) => {
          if (!isVisible) {
            setSelectedTransition(null);
          }
        }}
        formValidators={transitionsFormValidators}
        onSubmit={handleEditTransitionDrawerSubmit}
        onDelete={() => {
          if (selectedTransition) {
            dispatch({
              type: 'REMOVE_TRANSITION',
              payload: {
                transitionId: selectedTransition.id,
              },
            });
          }
        }}
      />
      <TransitionDrawer
        availableStatuses={AVAILABLE_STATUSES}
        availableActions={AVAILABLE_ACTIONS}
        disabledStatuses={newTransition ? [newTransition.fromStatus] : []}
        disabledActions={state.transitions
          .filter((transition) => transition.fromStatus === newTransition?.fromStatus)
          .map((transition) => transition.condition.action)
          .filter(notEmpty)}
        workflowType={workflowType}
        isVisible={newTransition != null}
        initialValues={{}}
        onChangeVisibility={(isVisible) => {
          if (!isVisible) {
            setNewTransition(null);
          }
        }}
        formValidators={transitionsFormValidators}
        onSubmit={handleNewTransitionDrawerSubmit}
      />
    </div>
  );
}

function statusNodeId(status: string) {
  return `status-node-${status}`;
}

function getNodesAndEdges(state: WorkflowBuilderState): {
  nodes: NodeDescription[];
  edges: EdgeDescription[];
} {
  const nodes: NodeDescription[] = [];
  const edges: EdgeDescription[] = [];

  const usedStatuses = uniq([
    START_STATE,
    ...state.transitions.flatMap(({ fromStatus, outcome }) => [
      fromStatus,
      outcome.status ?? FINAL_STATE,
    ]),
  ]);
  usedStatuses.sort((a, b) => {
    return AVAILABLE_STATUSES.indexOf(a) - AVAILABLE_STATUSES.indexOf(b);
  });

  for (const status of usedStatuses) {
    nodes.push({
      id: statusNodeId(status),
      type: 'STATUS',
      data: {
        status,
        order: usedStatuses.indexOf(status),
      },
    });
  }

  // Add existed transitions nodes
  for (const transition of state.transitions) {
    const { fromStatus, condition, outcome } = transition;
    const fromStatusNodeId = statusNodeId(fromStatus);
    const toStatusNodeId = statusNodeId(outcome.status ?? FINAL_STATE);
    const transitionNodeId = `if-node-${transition.fromStatus}-${condition.action}`;
    nodes.push({
      id: transitionNodeId,
      type: 'TRANSITION',
      data: {
        transitionId: transition.id,
        condition: {
          action: condition.action,
        },
        outcome: {
          status: outcome.status ?? FINAL_STATE,
          assignee: outcome.assignee,
        },
      },
    });
    edges.push({
      id: `edge:${fromStatusNodeId}:${transitionNodeId}`,
      source: fromStatusNodeId,
      target: transitionNodeId,
    });
    edges.push({
      id: `edge:${transitionNodeId}:${toStatusNodeId}`,
      source: transitionNodeId,
      target: toStatusNodeId,
    });
  }

  // Add buttons for new transitions
  for (const status of usedStatuses) {
    if (status === FINAL_STATE) {
      continue;
    }
    const buttonNodeId = `new-branch-button-node-${status}`;
    const statusId = statusNodeId(status);
    nodes.push({
      id: buttonNodeId,
      type: 'NEW_BRANCH_BUTTON',
      data: {
        fromStatus: status,
      },
    });
    edges.push({
      id: `edge:${statusId}:${buttonNodeId}`,
      source: statusId,
      target: buttonNodeId,
    });
  }

  return { nodes, edges };
}
