import { NodeCanvasState, NodeState } from '@/components/WorkflowBuilder/NodeCanvas/types';

export function isStatusNode(node: NodeState): node is NodeState<'STATUS'> {
  return node.type === 'STATUS';
}

export function isTransitionNode(node: NodeState): node is NodeState<'TRANSITION'> {
  return node.type === 'TRANSITION';
}

export function isNewBranchButtonNode(node: NodeState): node is NodeState<'NEW_BRANCH_BUTTON'> {
  return node.type === 'NEW_BRANCH_BUTTON';
}

export function getStatusNodeTransitions(
  state: NodeCanvasState,
  statusNode: NodeState<'STATUS'>,
): NodeState<'TRANSITION'>[] {
  const { nodes, edges } = state;
  return nodes.filter((node): node is NodeState<'TRANSITION'> => {
    return (
      isTransitionNode(node) &&
      edges.some((edge) => edge.source === statusNode.id && edge.target === node.id)
    );
  });
}

export function getStatusNewBranchNode(
  state: NodeCanvasState,
  statusNode: NodeState<'STATUS'>,
): NodeState<'NEW_BRANCH_BUTTON'> | undefined {
  const { nodes, edges } = state;
  return nodes.find((node): node is NodeState<'NEW_BRANCH_BUTTON'> => {
    return (
      isNewBranchButtonNode(node) &&
      edges.some((edge) => edge.source === statusNode.id && edge.target === node.id)
    );
  });
}

export function getTransitionSourceNode(
  state: NodeCanvasState,
  transitionNode: NodeState<'TRANSITION'>,
): NodeState<'STATUS'> | undefined {
  const edge = state.edges.find((edge) => edge.target === transitionNode.id);
  const sourceNode =
    edge != null &&
    state.nodes.find(
      (node): node is NodeState<'STATUS'> => isStatusNode(node) && node.id === edge.source,
    );
  return sourceNode || undefined;
}

export function getTransitionTargetNode(
  state: NodeCanvasState,
  transitionNode: NodeState<'TRANSITION'>,
): NodeState<'STATUS'> | undefined {
  const edge = state.edges.find((edge) => edge.source === transitionNode.id);
  const targetNode =
    edge != null &&
    state.nodes.find(
      (node): node is NodeState<'STATUS'> => isStatusNode(node) && node.id === edge.target,
    );
  return targetNode || undefined;
}
