import React, { useMemo } from 'react';
import { NodeDescription } from './types';

interface NodeContextValue<NodeType, NodeData> {
  onClickNode(node: NodeDescription<NodeType, NodeData>): void;
}

const NodeContext = React.createContext<NodeContextValue<unknown, unknown> | null>(null);

export function NodeContextProvider<NodeType, NodeData>(
  props: {
    children: React.ReactNode;
  } & Partial<NodeContextValue<NodeType, NodeData>>,
) {
  const { onClickNode, children } = props;

  const value: NodeContextValue<NodeType, NodeData> = useMemo(
    () => ({
      onClickNode: onClickNode ?? (() => {}),
    }),
    [onClickNode],
  );
  return <NodeContext.Provider value={value}>{children}</NodeContext.Provider>;
}

export function useNodeContext<NodeType, NodeData>(): NodeContextValue<NodeType, NodeData> {
  const contextValue = React.useContext(NodeContext);
  if (!contextValue) {
    throw new Error('useNodeContext must be used within a NodeContextProvider');
  }
  return contextValue;
}
