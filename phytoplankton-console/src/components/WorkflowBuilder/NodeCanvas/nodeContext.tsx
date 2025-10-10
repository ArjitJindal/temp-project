import React, { useMemo } from 'react';
import { NodeDescription, NodeTypes } from './types';
import { AsyncResource, loading, success } from '@/utils/asyncResource';
import { AccountRole } from '@/apis';
import { useRoles } from '@/utils/user-utils';

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

  const [roles, isLoading] = useRoles();

  const value: NodeContextValue = useMemo(
    () => ({
      onClickNode: onClickNode ?? (() => {}),
      availableRoles: isLoading ? loading(roles) : success(roles),
    }),
    [onClickNode, isLoading, roles],
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
