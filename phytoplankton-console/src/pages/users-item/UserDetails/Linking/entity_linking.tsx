import React, { useState, useCallback } from 'react';
import s from './index.module.less';
import UserGraph, { GraphParams } from './UserGraph';
import * as Card from '@/components/ui/Card';
import SegmentedControl, { Item } from '@/components/library/SegmentedControl';
import { useApi } from '@/api';

export type ScopeSelectorValue = 'ENTITY' | 'TXN';

type Props = { userId: string };
const Linking = (props: Props) => {
  const items: Item<ScopeSelectorValue>[] = [
    { value: 'ENTITY', label: 'Entity view' },
    { value: 'TXN', label: 'Transactions view' },
  ];
  const [scope, setScope] = useState<ScopeSelectorValue>('ENTITY');
  const api = useApi();

  const getUser = useCallback(
    (userId: string, filters: { afterTimestamp?: number; beforeTimestamp?: number }) => {
      return api.getUserEntity({
        userId,
        afterTimestamp: filters.afterTimestamp,
        beforeTimestamp: filters.beforeTimestamp,
      });
    },
    [api],
  );

  const getTxn = useCallback<GraphParams>(
    (userId: string, filters: { afterTimestamp?: number; beforeTimestamp?: number }) => {
      return api.getTxnLinking({
        userId,
        afterTimestamp: filters.afterTimestamp,
        beforeTimestamp: filters.beforeTimestamp,
      });
    },
    [api],
  );

  return (
    <Card.Root className={s.root}>
      <div className={s.scopeSelector}>
        <SegmentedControl<ScopeSelectorValue>
          size="MEDIUM"
          active={scope}
          items={items}
          onChange={setScope}
        />
      </div>
      {scope === 'ENTITY' && (
        <UserGraph
          scope={scope}
          userId={props.userId}
          getGraph={getUser}
          edgeInterpolation={'linear'}
          edgeArrowPosition={'none'}
          isFollowEnabled={(id: string) => id.startsWith('user:')}
        />
      )}
      {scope === 'TXN' && (
        <UserGraph
          scope={scope}
          userId={props.userId}
          getGraph={getTxn}
          edgeInterpolation={'curved'}
          edgeArrowPosition={'end'}
          isFollowEnabled={(id: string) => id.startsWith('payment:') || id.startsWith('user:')}
        />
      )}
    </Card.Root>
  );
};

export default Linking;
