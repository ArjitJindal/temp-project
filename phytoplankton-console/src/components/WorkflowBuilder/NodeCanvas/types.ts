import { ComponentProps } from 'react';
import { Edge as ReactFlowEdge, Edge, Node as ReactFlowNode, Position } from '@xyflow/react';
import StatusNode from '@/components/WorkflowBuilder/NodeCanvas/nodes/StatusNode';
import TransitionNode from '@/components/WorkflowBuilder/NodeCanvas/nodes/TransitionNode';
import NewBranchButtonNode from '@/components/WorkflowBuilder/NodeCanvas/nodes/NewBranchButtonNode';

export const NODE_TYPES_TYPED = {
  STATUS: StatusNode,
  TRANSITION: TransitionNode,
  NEW_BRANCH_BUTTON: NewBranchButtonNode,
} as const;

export type NodeTypes = keyof typeof NODE_TYPES_TYPED;
export type GetNodeDataType<NodeType> = NodeType extends NodeTypes
  ? ComponentProps<typeof NODE_TYPES_TYPED[NodeType]>['data']
  : never;

export type NodeSizes = {
  [id: string]: { width: number; height: number } | undefined;
};

export type NodeDescription<NodeType extends NodeTypes = NodeTypes> = {
  id: string;
  type: NodeType;
  data: GetNodeDataType<NodeType>;
};

export type EdgeData = {
  sourcePosition?: Position;
  targetPosition?: Position;
};

export type EdgeDescription = Pick<Edge<EdgeData>, 'id' | 'source' | 'target'>;

export type NodeState<NodeType extends NodeTypes = NodeTypes> = NodeDescription<NodeType> &
  Pick<ReactFlowNode, 'position'>;
export type EdgeState = EdgeDescription &
  Pick<ReactFlowEdge, 'type' | 'markerEnd' | 'data' | 'sourceHandle' | 'targetHandle'>;

export type NodeCanvasState = {
  nodes: NodeState[];
  edges: EdgeState[];
};
