import {
  applyNodeChanges,
  Background,
  Controls,
  EdgeTypes,
  MarkerType,
  NodeProps,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ComponentType, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { EdgeUpdate, LayoutState, LayoutUpdates, NodeUpdate } from './layout';
import {
  EdgeDescription,
  EdgeState,
  NodeCanvasState,
  NodeDescription,
  NodeSizes,
  NodeState,
} from './types';
import DefaultEdge from './edges/DefaultEdge';
import { NodeContextProvider } from './nodeContext';
import { convertHandlePosition, getHandleId } from './helpers';
import { COLORS_V2_GRAY_1 } from '@/components/ui/colors';
import { usePrevious } from '@/utils/hooks';
import { isEqual } from '@/utils/lang';

export const EDGE_TYPES_TYPED = {
  DefaultEdge,
};

export const EDGE_TYPES: EdgeTypes = EDGE_TYPES_TYPED as EdgeTypes;

export type NodeComponentProps<NodeType extends string, NodeData> = NodeProps & {
  data: NodeData;
  type: NodeType;
};

export type NodeComponentType<NodeType extends string, NodeData> = ComponentType<
  NodeComponentProps<NodeType, NodeData>
>;

export interface Props<Nodes extends NodeDescription<string, unknown>> {
  nodeTypes: {
    [Key in Nodes['type']]: NodeComponentType<string, any>;
  };
  onNodeClick?: (node: Nodes) => void;
  nodes: Nodes[];
  edges: EdgeDescription[];
  onCalculateLayout?: (layoutState: LayoutState<Nodes>) => LayoutUpdates<Nodes>;
}

export function NodeCanvas<Nodes extends NodeDescription<string, Record<string, unknown>>>(
  props: Props<Nodes>,
) {
  type NodeType = Nodes['type'];
  type NodeData = Nodes['data'];
  const {
    nodeTypes: nodeTypes,
    nodes: propsNodes,
    edges: propsEdges,
    onCalculateLayout,
    onNodeClick,
  } = props;

  const [sizes, setSizes] = useState<NodeSizes>({});

  const [nodesAndEdges, setNodesAndEdges] = useState<NodeCanvasState<Nodes>>(
    (): NodeCanvasState<Nodes> => {
      return {
        nodes: prepareNodes(propsNodes),
        edges: prepareEdges(propsEdges),
      };
    },
  );

  const handleLayout = useCallback(
    (sizes: NodeSizes) => {
      if (onCalculateLayout == null) {
        return;
      }
      setNodesAndEdges((canvasState): NodeCanvasState<Nodes> => {
        const layoutUpdates = onCalculateLayout?.({ ...canvasState, sizes });
        return {
          nodes: canvasState.nodes.map((node): NodeState<Nodes> => {
            const update = layoutUpdates.find(
              (x): x is NodeUpdate<Nodes> => x.kind === 'NODE_UPDATE' && x.id === node.id,
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
                source: update.source.id,
                target: update.target.id,
                sourceHandle: getHandleId(update.source.id, update.source.handle, 'SOURCE'),
                targetHandle: getHandleId(update.target.id, update.target.handle, 'TARGET'),
                data: {
                  sourcePosition: convertHandlePosition(update.source.handle),
                  targetPosition: convertHandlePosition(update.target.handle),
                },
              };
            }
            return edge;
          }),
        };
      });
    },
    [onCalculateLayout, setNodesAndEdges],
  );

  const previousNodes = usePrevious(propsNodes);
  const previousEdges = usePrevious(propsEdges);
  useEffect(() => {
    if (
      previousNodes &&
      previousEdges &&
      (!isEqual(previousNodes, propsNodes) || !isEqual(previousEdges, propsEdges))
    ) {
      setNodesAndEdges((prevState): NodeCanvasState<Nodes> => {
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
          edges.some((y) => y.id === x.id && !isEqual(x, y.description)),
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
                .map((node): NodeState<Nodes> => {
                  const updatedNode = updatedNodes.find(({ id }) => node.id === id);
                  if (updatedNode) {
                    return {
                      ...node,
                      data: {
                        ...(node.data as any),
                        ...(updatedNode.data as any),
                      },
                    } as unknown as NodeState<Nodes>;
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
                      source: updatedEdge.source.id,
                      target: updatedEdge.target.id,
                      sourceHandle: getHandleId(
                        updatedEdge.source.id,
                        updatedEdge.source.handle,
                        'SOURCE',
                      ),
                      targetHandle: getHandleId(
                        updatedEdge.target.id,
                        updatedEdge.target.handle,
                        'TARGET',
                      ),
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
    <NodeContextProvider<NodeType, NodeData> onClickNode={onNodeClick}>
      <ReactFlow
        nodesDraggable={false}
        nodesFocusable={false}
        elementsSelectable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        edgesReconnectable={false}
        nodes={
          nodesAndEdges.nodes as NodeState<{
            id: string;
            type: string;
            data: Record<string, unknown>;
          }>[]
        }
        edges={nodesAndEdges.edges}
        onNodeClick={() => {}}
        onInit={(reactFlowInstance) => {
          reactFlowInstance.fitView({ maxZoom: 1, padding: 0.1 });
        }}
        onNodesChange={(changes) => {
          setNodesAndEdges((prevState): NodeCanvasState<Nodes> => {
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
        nodeTypes={nodeTypes}
        edgeTypes={EDGE_TYPES}
      >
        <Background bgColor={COLORS_V2_GRAY_1} />
        <Controls />
      </ReactFlow>
    </NodeContextProvider>
  );
}

export default function <NodeTypes extends NodeDescription<string, Record<string, unknown>>>(
  props: Props<NodeTypes>,
) {
  return (
    <ReactFlowProvider>
      <NodeCanvas {...props} />
    </ReactFlowProvider>
  );
}

/*
  Helpers
 */
function prepareNodes<NodeTypes extends NodeDescription<string, unknown>>(
  nodes: NodeTypes[],
): NodeState<NodeTypes>[] {
  return nodes.map(
    (x): NodeState<NodeTypes> => ({
      id: x.id,
      type: x.type,
      data: x.data,
      position: { x: 0, y: 0 },
    }),
  );
}

function prepareEdges(edges: EdgeDescription[]): EdgeState[] {
  return edges.map(
    (x): EdgeState => ({
      id: x.id,
      description: x,
      type: 'DefaultEdge',
      source: x.source.id,
      target: x.target.id,
      markerEnd: {
        type: MarkerType.Arrow,
      },
    }),
  );
}
