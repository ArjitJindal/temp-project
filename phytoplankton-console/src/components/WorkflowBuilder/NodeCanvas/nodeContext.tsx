import React, { useMemo } from 'react';
import { NodeDescription, NodeTypes } from './types';
import { AsyncResource, map } from '@/utils/asyncResource';
import { AccountRole } from '@/apis';
import { useRoles } from '@/utils/api/auth';

interface NodeContextValue {
  availableRoles: AsyncResource<Array<AccountRole>>;
  onClickNode<NodeType extends NodeTypes>(node: NodeDescription<NodeType>): void;
}

const NodeContext = React.createContext<NodeContextValue | null>(null);

export function NodeContextProvider(
  props: {
    children: React.ReactNode;
  } & Partial<NodeContextValue>,
) {
  const { onClickNode, children } = props;

  const { roles } = useRoles();

  const value: NodeContextValue = useMemo(
    () => ({
      onClickNode: onClickNode ?? (() => {}),
      availableRoles: map(roles.data, (x) => x.items),
    }),
    [onClickNode, roles],
  );
  return <NodeContext.Provider value={value}>{children}</NodeContext.Provider>;
}

export function useNodeContext(): NodeContextValue {
  const contextValue = React.useContext(NodeContext);
  if (!contextValue) {
    throw new Error('useNodeContext must be used within a NodeContextProvider');
  }
  return contextValue;
}
