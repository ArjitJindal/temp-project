import { Node, Edge } from '@xyflow/react';

export type NodeSizes = {
  [id: string]: { width: number; height: number } | undefined;
};

export type NodeDescription = Pick<Node, 'id' | 'type' | 'data'>;
export type EdgeDescription = Pick<Edge, 'id' | 'source' | 'target'>;
