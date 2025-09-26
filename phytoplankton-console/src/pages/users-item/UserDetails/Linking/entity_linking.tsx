import React from 'react';
import s from './index.module.less';
import UserGraph, { GraphFilters, useLinkingState, useUserEntityFollow } from './UserGraph';
import * as Card from '@/components/ui/Card';
import SegmentedControl, { Item } from '@/components/library/SegmentedControl';
import { GraphEdges, GraphNodes } from '@/apis';

export type ScopeSelectorValue = 'ENTITY' | 'TXN';

type Props = {
  userId: string;
  scope: ScopeSelectorValue;
  onScopeChange: (scope: ScopeSelectorValue) => void;
  entityNodes: GraphNodes[];
  entityEdges: GraphEdges[];
  txnNodes: GraphNodes[];
  txnEdges: GraphEdges[];
  followed: string[];
  onFollow: (userId: string) => Promise<void>;
  entityFilters: GraphFilters;
  setEntityFilters: React.Dispatch<React.SetStateAction<GraphFilters>>;
  txnFilters: GraphFilters;
  setTxnFilters: React.Dispatch<React.SetStateAction<GraphFilters>>;
};

const Linking = (props: Props) => {
  const items: Item<ScopeSelectorValue>[] = [
    { value: 'ENTITY', label: 'Entity view' },
    { value: 'TXN', label: 'Transactions view' },
  ];

  return (
    <Card.Root className={s.root}>
      <div className={s.scopeSelector}>
        <SegmentedControl<ScopeSelectorValue>
          size="MEDIUM"
          active={props.scope}
          items={items}
          onChange={props.onScopeChange}
        />
      </div>
      {props.scope === 'ENTITY' && (
        <UserGraph
          scope={props.scope}
          userId={props.userId}
          nodes={props.entityNodes}
          edges={props.entityEdges}
          followed={props.followed}
          onFollow={props.onFollow}
          filters={props.entityFilters}
          setFilters={props.setEntityFilters}
          edgeInterpolation={'linear'}
          edgeArrowPosition={'none'}
          isFollowEnabled={(id: string) => id.startsWith('user:')}
        />
      )}
      {props.scope === 'TXN' && (
        <UserGraph
          scope={props.scope}
          userId={props.userId}
          nodes={props.txnNodes}
          edges={props.txnEdges}
          followed={props.followed}
          onFollow={props.onFollow}
          filters={props.txnFilters}
          setFilters={props.setTxnFilters}
          edgeInterpolation={'curved'}
          edgeArrowPosition={'end'}
          isFollowEnabled={(id: string) => id.startsWith('payment:') || id.startsWith('user:')}
        />
      )}
    </Card.Root>
  );
};

export default function LinkingWrapper(props: { userId: string }) {
  const { userId } = props;
  const linkingState = useLinkingState(userId);
  const handleFollow = useUserEntityFollow(linkingState);

  return (
    <Linking
      userId={userId}
      scope={linkingState.scope}
      onScopeChange={linkingState.setScope}
      entityNodes={linkingState.entityNodes}
      entityEdges={linkingState.entityEdges}
      txnNodes={linkingState.txnNodes}
      txnEdges={linkingState.txnEdges}
      followed={linkingState.followed}
      onFollow={handleFollow}
      entityFilters={linkingState.entityFilters}
      setEntityFilters={linkingState.setEntityFilters}
      txnFilters={linkingState.txnFilters}
      setTxnFilters={linkingState.setTxnFilters}
    />
  );
}
