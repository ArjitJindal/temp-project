import React, { useState } from 'react';
import s from './index.module.less';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import * as Card from '@/components/ui/Card';
import { AlertTableParams } from '@/pages/case-management/AlertTable';
import AlertTableWrapper from '@/pages/case-management/AlertTable/AlertTableWrappper';

interface Props {
  userId: string;
}

export default function AlertsCard(props: Props) {
  const { userId } = props;

  const [params, setParams] = useState<AlertTableParams>({
    ...DEFAULT_PARAMS_STATE,
    userId,
    showCases: 'ALL_ALERTS',
  });

  return (
    <Card.Root className={s.root}>
      <Card.Section>
        <AlertTableWrapper
          showUserFilters={false}
          params={params}
          onChangeParams={(newState) =>
            setParams((prevState) => ({
              ...prevState,
              ...newState,
              userId,
            }))
          }
        />
      </Card.Section>
    </Card.Root>
  );
}
