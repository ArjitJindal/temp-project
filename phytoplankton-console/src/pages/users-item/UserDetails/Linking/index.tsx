import React, { useState } from 'react';
import s from './index.module.less';
import UserGraph from './UserGraph';
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
          userId={props.userId}
          getGraph={(userId) => api.getUserEntity({ userId })}
          edgeInterpolation={'linear'}
          edgeArrowPosition={'none'}
        />
      )}
      {scope === 'TXN' && (
        <UserGraph
          userId={props.userId}
          getGraph={(userId) => api.getTxnLinking({ userId })}
          edgeInterpolation={'curved'}
          edgeArrowPosition={'end'}
        />
      )}
    </Card.Root>
  );
};

export default Linking;
