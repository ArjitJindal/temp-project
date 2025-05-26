import {
  applyNodeChanges,
  Background,
  Controls,
  EdgeTypes,
  MarkerType,
  NodeTypes,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { EdgeUpdate, NodeUpdate, updateLayout } from './layoutHelpers';
import {
  EdgeDescription,
  EdgeState,
  NODE_TYPES_TYPED,
  NodeCanvasState,
  NodeDescription,
  NodeSizes,
  NodeState,
} from './types';
import DefaultEdge from '@/components/WorkflowBuilder/NodeCanvas/edges/DefaultEdge';
import { COLORS_V2_GRAY_1 } from '@/components/ui/colors';
import { usePrevious } from '@/utils/hooks';
import { isEqual } from '@/utils/lang';
import { NodeContextProvider } from '@/components/WorkflowBuilder/NodeCanvas/nodeContext';

export const NODE_TYPES: NodeTypes = NODE_TYPES_TYPED as NodeTypes;

export const EDGE_TYPES_TYPED = {
  DefaultEdge,
};

export const EDGE_TYPES: EdgeTypes = EDGE_TYPES_TYPED as EdgeTypes;

interface Props {
  onNodeClick?: (node: NodeDescription) => void;
  nodes: NodeDescription[];
  edges: EdgeDescription[];
}

export function NodeCanvas(props: Props) {
  const { nodes: propsNodes, edges: propsEdges, onNodeClick } = props;

  const [sizes, setSizes] = useState<NodeSizes>({});

  const [nodesAndEdges, setNodesAndEdges] = useState<NodeCanvasState>((): NodeCanvasState => {
    return {
      nodes: prepareNodes(propsNodes),
      edges: prepareEdges(propsEdges),
    };
  });

  const handleLayout = useCallback(
    (sizes: NodeSizes) => {
      setNodesAndEdges((canvasState): NodeCanvasState => {
        const layoutUpdates = updateLayout({ ...canvasState, sizes });
        return {
          nodes: canvasState.nodes.map((node): NodeState => {
            const update = layoutUpdates.find(
              (x): x is NodeUpdate => x.kind === 'NODE_UPDATE' && x.id === node.id,
            );
            if (update) {
              return { ...node, position: update.position ?? node.position };
            }
            return node;
          }),
          edges: canvasState.edges.map((edge) => {
            const update = layoutUpdates.find(
              (x): x is EdgeUpdate => x.kind === 'EDGE_UPDATE' && x.id === edge.id,
            );
            if (update) {
              return {
                ...edge,
                ...update,
              };
            }
            return edge;
          }),
        };
      });
    },
    [setNodesAndEdges],
  );

  const previousNodes = usePrevious(propsNodes);
  const previousEdges = usePrevious(propsEdges);
  useEffect(() => {
    if (
      previousNodes &&
      previousEdges &&
      (!isEqual(previousNodes, propsNodes) || !isEqual(previousEdges, propsEdges))
    ) {
      setNodesAndEdges((prevState) => {
        const { nodes, edges } = prevState;

        // Calc nodes difference
        const deletedNodeIds = nodes
          .filter((x) => !propsNodes.find((y) => y.id === x.id))
          .map((x) => x.id);
        const addedNodes = propsNodes.filter((x) => !nodes.some((y) => y.id === x.id));
        const updatedNodes = propsNodes.filter((x) =>
          nodes.some((y) => y.id === x.id && !isEqual(x.data, y.data)),
        );
        const isNodesChanged =
          deletedNodeIds.length !== 0 || addedNodes.length !== 0 || updatedNodes.length !== 0;

        // Calc edges difference
        const deletedEdgeIds = edges
          .filter((x) => !propsEdges.find((y) => y.id === x.id))
          .map((x) => x.id);
        const addedEdges = propsEdges.filter((x) => !edges.some((y) => y.id === x.id));
        const updatedEdges = propsEdges.filter((x) =>
          edges.some((y) => y.id === x.id && !isEqual(x, y)),
        );
        const isEdgesChanged =
          deletedEdgeIds.length !== 0 || addedEdges.length !== 0 || updatedEdges.length !== 0;

        if (!isNodesChanged && !isEdgesChanged) {
          return prevState;
        }

        const newNodesState = isNodesChanged
          ? [
              ...nodes
                .filter((x) => !deletedNodeIds.includes(x.id))
                .map((node) => {
                  const updatedNode = updatedNodes.find(({ id }) => node.id === id);
                  if (updatedNode) {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        ...updatedNode.data,
                      },
                    };
                  }
                  return node;
                }),
              ...prepareNodes(addedNodes),
            ]
          : nodes;
        const newEdgesState = isEdgesChanged
          ? [
              ...edges
                .filter((edge) => !deletedEdgeIds.includes(edge.id))
                .map((edge) => {
                  const updatedEdge = updatedEdges.find(({ id }) => edge.id === id);
                  if (updatedEdge) {
                    return {
                      ...edge,
                      ...updatedEdge,
                    };
                  }
                  return edge;
                }),
              ...prepareEdges(addedEdges),
            ]
          : edges;

        return {
          nodes: newNodesState,
          edges: newEdgesState,
        };
      });

      handleLayout(sizes);
    }
  }, [previousNodes, previousEdges, propsNodes, propsEdges, sizes, handleLayout]);

  useLayoutEffect(() => {
    handleLayout(sizes);
  }, [sizes, handleLayout]);

  return (
    <NodeContextProvider onClickNode={onNodeClick}>
      <ReactFlow
        nodesDraggable={false}
        nodesFocusable={false}
        elementsSelectable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        edgesReconnectable={false}
        nodes={nodesAndEdges.nodes}
        edges={nodesAndEdges.edges}
        onNodeClick={() => {}}
        onInit={(reactFlowInstance) => {
          reactFlowInstance.fitView({ maxZoom: 1, padding: 0.1 });
        }}
        onNodesChange={(changes) => {
          setNodesAndEdges((prevState): NodeCanvasState => {
            return {
              ...prevState,
              nodes: applyNodeChanges(changes, prevState.nodes),
            };
          });
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
    </NodeContextProvider>
  );
}

export default (props: Props) => {
  return (
    <ReactFlowProvider>
      <NodeCanvas {...props} />
    </ReactFlowProvider>
  );
};

/*
  Helpers
 */
function prepareNodes(nodes: NodeDescription[]): NodeState[] {
  return nodes.map((x): NodeState => ({ ...x, position: { x: 0, y: 0 } }));
}

function prepareEdges(edges: EdgeDescription[]): EdgeState[] {
  return edges.map(
    (x): EdgeState => ({
      ...x,
      type: 'DefaultEdge',
      markerEnd: {
        type: MarkerType.Arrow,
      },
    }),
  );
}
