import Dagre from '@dagrejs/dagre';
import { EdgeDescription, NodeDescription, NodeSizes } from '../types';

const NODE_MARGIN = 20;

export function getLayoutedElements(
  nodes: NodeDescription[],
  edges: EdgeDescription[],
  sizes: NodeSizes,
): {
  nodesUpdates: {
    id: string;
    position: {
      x: number;
      y: number;
    };
  }[];
} {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 100 });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) =>
    g.setNode(node.id, {
      width: sizes[node.id]?.width ?? 0,
      height: sizes[node.id]?.height ?? 0,
    }),
  );

  Dagre.layout(g);

  return {
    nodesUpdates: nodes.map((node) => {
      const position = g.node(node.id);
      const size = sizes[node.id];
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      const x = position.x - (size?.width ?? 0) / 2 + NODE_MARGIN;
      const y = position.y - (size?.height ?? 0) / 2 + NODE_MARGIN;

      return { id: node.id, position: { x, y } };
    }),
  };
}
