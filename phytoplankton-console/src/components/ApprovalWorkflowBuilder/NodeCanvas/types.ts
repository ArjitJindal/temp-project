import { Edge as ReactFlowEdge, Node as ReactFlowNode } from '@xyflow/react';

export type HandlePosition = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';

export type NodeSizes = {
  [id: string]: { width: number; height: number } | undefined;
};

export type HandleType = 'TARGET' | 'SOURCE';

export type NodeDescription<NodeType, NodeData> = {
  id: string;
  type: NodeType;
  data: NodeData;
};

export type EdgeMountPoint = {
  id: string;
  handle: HandlePosition;
};

export type EdgeDescription = {
  id: string;
  source: EdgeMountPoint;
  target: EdgeMountPoint;
};

export type NodeState<Node extends NodeDescription<string, unknown>> = NodeDescription<
  Node['type'],
  Node['data']
> &
  Pick<ReactFlowNode, 'id' | 'position'>;

export type EdgeState = Pick<
  ReactFlowEdge,
  'id' | 'type' | 'markerEnd' | 'data' | 'sourceHandle' | 'targetHandle' | 'source' | 'target'
> & {
  description: EdgeDescription;
};

export type NodeCanvasState<NodeTypes extends NodeDescription<string, unknown>> = {
  nodes: NodeState<NodeTypes>[];
  edges: EdgeState[];
};
