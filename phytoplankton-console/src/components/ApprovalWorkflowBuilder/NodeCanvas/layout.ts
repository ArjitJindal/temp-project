import { EdgeMountPoint, NodeCanvasState, NodeDescription, NodeSizes, NodeState } from './types';

export type LayoutState<NodeTypes extends NodeDescription<string, unknown>> =
  NodeCanvasState<NodeTypes> & {
    sizes: NodeSizes;
  };

export type NodeUpdate<NodeTypes extends NodeDescription<string, unknown>> = {
  kind: 'NODE_UPDATE';
  id: string;
} & Partial<NodeState<NodeTypes>>;

export type EdgeUpdate = {
  kind: 'EDGE_UPDATE';
  id: string;
  source: EdgeMountPoint;
  target: EdgeMountPoint;
};

export type LayoutUpdate<NodeTypes extends NodeDescription<string, unknown>> =
  | NodeUpdate<NodeTypes>
  | EdgeUpdate;

export type LayoutUpdates<NodeTypes extends NodeDescription<string, unknown>> =
  LayoutUpdate<NodeTypes>[];
