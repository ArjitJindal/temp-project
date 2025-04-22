import {
  Background,
  Controls,
  EdgeTypes,
  MarkerType,
  NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useLayoutEffect, useState } from 'react';
import DefaultEdge from '../edges/DefaultEdge';
import IfNode from '../nodes/IfNode';
import NewBranchButtonNode from '../nodes/NewBranchButtonNode';
import StatusNode from '../nodes/StatusNode';
import ThenNode from '../nodes/ThenNode';
import { EdgeDescription, NodeDescription, NodeSizes } from '../types';
import { getLayoutedElements } from './helpers';
import { COLORS_V2_GRAY_1 } from '@/components/ui/colors';
import { useIsChanged } from '@/utils/hooks';
import { isEqual } from '@/utils/lang';

export const NODE_TYPES_TYPED = {
  StatusNode,
  IfNode,
  ThenNode,
  NewBranchButtonNode,
};

export const NODE_TYPES: NodeTypes = NODE_TYPES_TYPED as NodeTypes;

export const EDGE_TYPES_TYPED = {
  DefaultEdge,
};

export const EDGE_TYPES: EdgeTypes = EDGE_TYPES_TYPED as EdgeTypes;

interface Props {
  nodes: NodeDescription[];
  edges: EdgeDescription[];
}

export function NodeCanvas(props: Props) {
  const { nodes: initialNodes, edges: initialEdges } = props;

  const [sizes, setSizes] = useState<NodeSizes>({});
  const [nodes, setNodes] = useNodesState(
    initialNodes.map((x) => ({ ...x, position: { x: 0, y: 0 } })),
  );
  const [edges] = useEdgesState(
    initialEdges.map((x) => ({
      ...x,
      type: 'DefaultEdge',
      markerEnd: {
        type: MarkerType.Arrow,
      },
    })),
  );

  const handleLayout = useCallback(() => {
    const { nodesUpdates } = getLayoutedElements(nodes, edges, sizes);
    setNodes((nodes) => {
      return nodes.map((node) => {
        const update = nodesUpdates.find((x) => x.id === node.id);
        if (update) {
          return { ...node, position: update.position };
        }
        return node;
      });
    });
  }, [nodes, edges, setNodes, sizes]);

  const isSizesChanged = useIsChanged(sizes);
  useLayoutEffect(() => {
    if (isSizesChanged) {
      handleLayout();
    }
  }, [isSizesChanged, handleLayout]);

  return (
    <ReactFlow
      nodesDraggable={false}
      nodesFocusable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      edgesReconnectable={false}
      nodes={nodes}
      edges={edges}
      onNodesChange={(changes) => {
        for (const change of changes) {
          if (change.type === 'dimensions' && !isEqual(sizes[change.id], change.dimensions)) {
            setSizes((prev: NodeSizes): NodeSizes => {
              if (isEqual(prev[change.id], change.dimensions)) {
                return prev;
              }
              return {
                ...prev,
                [change.id]: change.dimensions,
              };
            });
          }
        }
      }}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
    >
      <Background bgColor={COLORS_V2_GRAY_1} />
      <Controls />
    </ReactFlow>
  );
}

export default (props: Props) => {
  return (
    <ReactFlowProvider>
      <NodeCanvas {...props} />
    </ReactFlowProvider>
  );
};
