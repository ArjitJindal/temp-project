import { Position } from '@xyflow/system';
import { EdgeState, NodeCanvasState, NodeSizes, NodeState } from './types';
import { getHandleId } from '@/components/WorkflowBuilder/NodeCanvas/components/NodeBase/helpers';
import {
  getStatusNewBranchNode,
  getStatusNodeTransitions,
  getTransitionSourceNode,
  getTransitionTargetNode,
  isStatusNode,
  isTransitionNode,
} from '@/components/WorkflowBuilder/NodeCanvas/graphHelpers';

const NODE_MARGIN = 50;

type Offsets = {
  x: number;
  y: number;
};

export type LayoutState = NodeCanvasState & {
  sizes: NodeSizes;
};

export type NodeUpdate = {
  kind: 'NODE_UPDATE';
  id: string;
} & Partial<NodeState>;

export type EdgeUpdate = {
  kind: 'EDGE_UPDATE';
  id: string;
} & Partial<EdgeState>;

export type LayoutUpdate = NodeUpdate | EdgeUpdate;

export type LayoutUpdates = LayoutUpdate[];

export function updateLayout(layoutState: LayoutState): LayoutUpdates {
  const { nodes, edges, sizes } = layoutState;

  const result: LayoutUpdate[] = [];

  // Layout status nodes
  const statusNodesUpdates = layoutStatusNodes({ x: 0, y: 0 }, layoutState);
  result.push(...statusNodesUpdates.layoutUpdates);

  // Adjust edges mount point
  result.push(...adjustEdgesMountPoints({ nodes, edges, sizes }));

  return result;
}

/*
  Subroutines for layouting
 */
function layoutStatusNodes(
  offsets: Offsets,
  layoutState: LayoutState,
): {
  layoutUpdates: LayoutUpdate[];
  offsetUpdates: Offsets;
} {
  const { nodes, sizes } = layoutState;

  let offsetUpdates: Offsets = { ...offsets };
  const layoutUpdates: LayoutUpdates = [];

  const statusNodes = nodes.filter(isStatusNode);
  statusNodes.sort((a, b) => a.data.order - b.data.order);

  for (const statusNode of statusNodes) {
    // Add space after previous status node
    if (offsetUpdates.y > 0) {
      offsetUpdates.y += NODE_MARGIN;
    }

    const nodeSize = sizes[statusNode.id] ?? { height: 0, width: 0 };
    layoutUpdates.push({
      kind: 'NODE_UPDATE',
      id: statusNode.id,
      position: {
        x: -nodeSize.width / 2,
        y: offsetUpdates.y,
      },
    });
    offsetUpdates.y += nodeSize.height;

    /*
      Layout all dependent transition nodes
     */
    const transitionNodesUpdates = layoutTransitionNodes(statusNode, offsetUpdates, layoutState);
    offsetUpdates = transitionNodesUpdates.offsetUpdates;
    layoutUpdates.push(...transitionNodesUpdates.layoutUpdates);
  }

  return { offsetUpdates, layoutUpdates };
}

function layoutTransitionNodes(
  statusNode: NodeState<'STATUS'>,
  offsets: Offsets,
  layoutState: LayoutState,
): {
  layoutUpdates: LayoutUpdate[];
  offsetUpdates: Offsets;
} {
  const { nodes, edges, sizes } = layoutState;

  const offsetUpdates: Offsets = { ...offsets };
  const layoutUpdates: LayoutUpdates = [];
  const statusNodeTransitions = getStatusNodeTransitions(layoutState, statusNode);

  // Order transitions node by the distance to target node. The longest path goes to left
  statusNodeTransitions.sort((a, b) => {
    const sourceNodeA = getTransitionSourceNode(layoutState, a);
    const sourceNodeB = getTransitionSourceNode(layoutState, b);
    const targetNodeA = getTransitionTargetNode(layoutState, a);
    const targetNodeB = getTransitionTargetNode(layoutState, b);
    const orderDifA = targetNodeA?.data.order ?? 0 - (sourceNodeA?.data.order ?? 0) ?? 0;
    const orderDifB = targetNodeB?.data.order ?? 0 - (sourceNodeB?.data.order ?? 0) ?? 0;
    return orderDifB - orderDifA;
  });
  const statusNewBranchNode = getStatusNewBranchNode({ nodes, edges }, statusNode);
  const dependentNodes = [
    ...statusNodeTransitions,
    ...(statusNewBranchNode ? [statusNewBranchNode] : []),
  ];
  const maxNodeHeight = dependentNodes.reduce(
    (acc, node) => Math.max(acc, sizes[node.id]?.height ?? 0),
    0,
  );
  const totalTransitionsNodeWidth = statusNodeTransitions.reduce(
    (acc, node, i) => acc + (i > 0 ? NODE_MARGIN : 0) + (sizes[node.id]?.width ?? 0),
    0,
  );
  if (dependentNodes.length > 0) {
    // Add space after previous nodes
    offsetUpdates.y += NODE_MARGIN;
  }
  if (statusNodeTransitions.length > 0) {
    let x = totalTransitionsNodeWidth > 0 ? -totalTransitionsNodeWidth / 2 : 0;
    for (let i = 0; i < dependentNodes.length; i++) {
      if (i > 0) {
        x += NODE_MARGIN;
      }
      const dependentNode = dependentNodes[i];
      layoutUpdates.push({
        kind: 'NODE_UPDATE',
        id: dependentNode.id,
        position: {
          x: x,
          y: offsetUpdates.y,
        },
      });
      x += sizes[dependentNode.id]?.width ?? 0;
    }
    offsetUpdates.y += maxNodeHeight;
  } else if (statusNewBranchNode != null) {
    const size = sizes[statusNewBranchNode.id];
    layoutUpdates.push({
      kind: 'NODE_UPDATE',
      id: statusNewBranchNode.id,
      position: {
        x: -(size?.width ?? 0) / 2,
        y: offsetUpdates.y,
      },
    });
    offsetUpdates.y += size?.height ?? 0;
  }
  return { offsetUpdates, layoutUpdates };
}

// function placeStateNode(node: NodeState, offsets: {
//   x: number,
//   y: number,
// }): {
//   layoutUpdates: LayoutUpdate[],
//   offsets: { x, y}
// } {
// }

/**
 * Selects better mount points based on nodes positions
 */
function adjustEdgesMountPoints(layoutState: LayoutState): LayoutUpdates {
  const { nodes, edges } = layoutState;
  const result: LayoutUpdate[] = [];
  for (const edge of edges) {
    const transitionNode = nodes.find(
      (node): node is NodeState<'TRANSITION'> => isTransitionNode(node) && node.id === edge.source,
    );
    const targetNode = nodes.find(
      (node): node is NodeState<'STATUS'> => isStatusNode(node) && node.id === edge.target,
    );
    if (transitionNode && targetNode) {
      const sourceNode = nodes.find((n2): n2 is NodeState<'STATUS'> => {
        return (
          isStatusNode(n2) &&
          edges.some((edge) => edge.source === n2.id && edge.target === transitionNode.id)
        );
      });
      if (sourceNode != null) {
        const isTargetStatusNodeOnTop = targetNode.data.order < sourceNode.data.order;
        if (isTargetStatusNodeOnTop) {
          result.push({
            kind: 'EDGE_UPDATE',
            id: edge.id,
            sourceHandle: getHandleId(transitionNode.id, 'RIGHT', 'SOURCE'),
            targetHandle: getHandleId(targetNode.id, 'RIGHT', 'TARGET'),
            data: {
              sourcePosition: Position.Right,
              targetPosition: Position.Right,
            },
          });
        }
        const isTargetStatusNodeOver2Levels = targetNode.data.order > sourceNode.data.order + 1;
        if (isTargetStatusNodeOver2Levels) {
          result.push({
            kind: 'EDGE_UPDATE',
            id: edge.id,
            sourceHandle: getHandleId(transitionNode.id, 'BOTTOM', 'SOURCE'),
            targetHandle: getHandleId(targetNode.id, 'LEFT', 'TARGET'),
            data: {
              sourcePosition: Position.Bottom,
              targetPosition: Position.Left,
            },
          });
        }
      }
    }
  }

  return result;
}
