import { useCallback, useMemo, useState } from 'react';
import NodeCanvas from './NodeCanvas';
import RoleNodeComponent from './components/nodes/RoleNodeComponent';
import { WorkflowBuilderStatePair } from './helpers';
import ChainElementDrawer from './components/ChainElementDrawer';
import TerminalNodeComponent from './components/nodes/TerminalNodeComponent';
import NewRoleButtonNodeComponent from './components/nodes/NewRoleButtonNodeComponent';
import { LayoutState, LayoutUpdates } from './NodeCanvas/layout';
import { EdgeDescription, NodeState } from './NodeCanvas/types';
import { ApprovalWorkflowNode, RoleNode, WorkflowBuilderState } from './types';

const START_NODE: ApprovalWorkflowNode = {
  id: 'START',
  type: 'TERMINAL',
  data: {
    type: 'START',
  },
};

const END_NODE: ApprovalWorkflowNode = {
  id: 'END',
  type: 'TERMINAL',
  data: {
    type: 'END',
  },
};

export default function ApprovalWorkflowBuilder(props: { state: WorkflowBuilderStatePair }) {
  const [state, dispatch] = props.state;

  const [selectedRoleNode, setSelectedRoleNode] = useState<RoleNode | null>(null);
  const [newRole, setNewRole] = useState<{
    afterRole: string | null;
  } | null>(null);

  const isNodesLimitReached = state.roles.length >= 3;

  const nodes = useMemo((): ApprovalWorkflowNode[] => {
    const result: ApprovalWorkflowNode[] = [START_NODE, END_NODE];

    result.push({
      id: getNewRoleButtonNodeId(START_NODE.id),
      type: 'NEW_ROLE_BUTTON',
      data: {
        isDisabled: isNodesLimitReached,
        afterRole: null,
      },
    });
    for (const role of state.roles) {
      result.push({
        id: getRoleNodeId(role),
        type: 'ROLE',
        data: {
          role: role,
        },
      });
      result.push({
        id: getNewRoleButtonNodeId(getRoleNodeId(role)),
        type: 'NEW_ROLE_BUTTON',
        data: {
          isDisabled: isNodesLimitReached,
          afterRole: role,
        },
      });
    }
    return result;
  }, [state.roles, isNodesLimitReached]);

  const edges = useMemo((): EdgeDescription[] => {
    return [
      {
        id: getEdgeId(
          START_NODE.id,
          state.roles.length > 0 ? getRoleNodeId(state.roles[0]) : END_NODE.id,
        ),
        source: {
          id: START_NODE.id,
          handle: 'BOTTOM',
        },
        target: {
          id: state.roles.length > 0 ? getRoleNodeId(state.roles[0]) : END_NODE.id,
          handle: 'TOP',
        },
      },
      {
        id: getEdgeId(START_NODE.id, getNewRoleButtonNodeId(START_NODE.id)),
        source: {
          id: START_NODE.id,
          handle: 'BOTTOM',
        },
        target: {
          id: getNewRoleButtonNodeId(START_NODE.id),
          handle: 'TOP',
        },
      },
      ...state.roles.flatMap((role, i): EdgeDescription[] => {
        return [
          {
            id: getEdgeId(
              getRoleNodeId(role),
              state.roles[i + 1] != null ? getRoleNodeId(state.roles[i + 1]) : END_NODE.id,
            ),
            source: {
              id: getRoleNodeId(role),
              handle: 'BOTTOM',
            },
            target: {
              id: state.roles[i + 1] != null ? getRoleNodeId(state.roles[i + 1]) : END_NODE.id,
              handle: 'TOP',
            },
          },
          {
            id: getEdgeId(getRoleNodeId(role), getNewRoleButtonNodeId(getRoleNodeId(role))),
            source: {
              id: getRoleNodeId(role),
              handle: 'BOTTOM',
            },
            target: {
              id: getNewRoleButtonNodeId(getRoleNodeId(role)),
              handle: 'TOP',
            },
          },
        ];
      }),
    ];
  }, [state.roles]);

  const handleLayout = useLayoutFunction(state);

  return (
    <>
      <NodeCanvas<ApprovalWorkflowNode>
        onNodeClick={(node) => {
          if (node.type === 'ROLE') {
            setSelectedRoleNode(node);
          } else if (node.type === 'NEW_ROLE_BUTTON') {
            setNewRole({
              afterRole: node.data?.afterRole ?? null,
            });
          }
        }}
        nodeTypes={{
          ROLE: RoleNodeComponent,
          TERMINAL: TerminalNodeComponent,
          NEW_ROLE_BUTTON: NewRoleButtonNodeComponent,
        }}
        nodes={nodes}
        edges={edges}
        onCalculateLayout={handleLayout}
      />
      <ChainElementDrawer
        rolesInUse={state.roles}
        initialValues={{
          role: '',
        }}
        isVisible={newRole != null}
        onChangeVisibility={(isVisible) => {
          if (!isVisible) {
            setNewRole(null);
          }
        }}
        onSubmit={(values) => {
          dispatch({
            type: 'ADD_ROLE',
            payload: {
              afterRole: newRole?.afterRole ?? null,
              role: values.role,
            },
          });
        }}
      />
      <ChainElementDrawer
        rolesInUse={state.roles}
        initialValues={{
          role: selectedRoleNode?.data?.role ?? '',
        }}
        isVisible={!!selectedRoleNode}
        onChangeVisibility={(isVisible) => {
          if (!isVisible) {
            setSelectedRoleNode(null);
          }
        }}
        onSubmit={(values) => {
          dispatch({
            type: 'REPLACE_ROLE',
            payload: {
              oldRole: selectedRoleNode?.data?.role ?? '',
              newRole: values.role,
            },
          });
        }}
        onDelete={() => {
          dispatch({
            type: 'DELETE_ROLE',
            payload: {
              role: selectedRoleNode?.data?.role ?? '',
            },
          });
        }}
      />
    </>
  );
}

/*
  Helpers
 */
function useLayoutFunction(state: WorkflowBuilderState) {
  return useCallback(
    (layoutState: LayoutState<ApprovalWorkflowNode>): LayoutUpdates<ApprovalWorkflowNode> => {
      const sizes = layoutState.sizes;

      function nodeX(nodeId) {
        return -((sizes[nodeId]?.width ?? 0) / 2);
      }

      let offset = 0;
      const vPadding = 50;
      const hPadding = 50;
      const result: LayoutUpdates<ApprovalWorkflowNode> = [];

      const roleNodes = layoutState.nodes
        .filter((node): node is NodeState<RoleNode> => node.type === 'ROLE')
        .sort((x, y) => {
          const indexX = state.roles.indexOf(x.data?.role);
          const indexY = state.roles.indexOf(y.data?.role);
          return indexX - indexY;
        });

      const startNodeX = nodeX(START_NODE.id);
      result.push({
        id: START_NODE.id,
        kind: 'NODE_UPDATE',
        position: {
          x: startNodeX,
          y: 0,
        },
      });
      offset += (sizes[START_NODE.id]?.height ?? 0) + vPadding;
      if (roleNodes.length > 0) {
        result.push({
          id: getNewRoleButtonNodeId(START_NODE.id),
          kind: 'NODE_UPDATE',
          position: {
            x: nodeX(roleNodes[0].id) + (sizes[roleNodes[0].id]?.width ?? 0) + hPadding,
            y: offset,
          },
        });
      } else {
        result.push({
          id: getNewRoleButtonNodeId(START_NODE.id),
          kind: 'NODE_UPDATE',
          position: {
            x: nodeX(getNewRoleButtonNodeId(START_NODE.id)) + hPadding,
            y: offset,
          },
        });
        offset += sizes[getNewRoleButtonNodeId(START_NODE.id)]?.height ?? 0;
      }

      for (let i = 0; i < roleNodes.length; i++) {
        const node = roleNodes[i];
        const y = offset;
        if (node.type === 'ROLE') {
          result.push({
            id: node.id,
            kind: 'NODE_UPDATE',
            position: {
              x: nodeX(node.id),
              y: y,
            },
          });
          offset += (sizes[node.id]?.height ?? 0) + vPadding;
          const nextNode = roleNodes[i + 1] ?? null;
          result.push({
            id: getNewRoleButtonNodeId(node.id),
            kind: 'NODE_UPDATE',
            position: {
              x: nextNode
                ? nodeX(nextNode.id) + (sizes[nextNode.id]?.width ?? 0) + hPadding
                : hPadding,
              y: offset,
            },
          });
        }
      }

      offset += vPadding;
      result.push({
        id: END_NODE.id,
        kind: 'NODE_UPDATE',
        position: {
          x: nodeX(END_NODE.id),
          y: offset,
        },
      });
      return result;
    },
    [state.roles],
  );
}

/*
  Helpers
 */

function getEdgeId(fromId: string, toId: string) {
  return `EDGE#${fromId}#${toId}`;
}

function getNewRoleButtonNodeId(parentId: string) {
  return `NEW_ROLE_BUTTON#${parentId}`;
}

function getRoleNodeId(role: string) {
  return `ROLE#${role}`;
}
