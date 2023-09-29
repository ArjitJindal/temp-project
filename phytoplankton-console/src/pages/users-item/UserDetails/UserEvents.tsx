import { useState } from 'react';
import s from './index.module.less';
import { useApi } from '@/api';
import { InternalUserEvent, SortOrder } from '@/apis';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { DATE_TIME, ID } from '@/components/library/Table/standardDataTypes';
import { CommonParams } from '@/components/library/Table/types';
import { useQuery } from '@/utils/queries/hooks';
import { USER_EVENTS_LIST } from '@/utils/queries/keys';
import * as Card from '@/components/ui/Card';

type Props = {
  userId: string;
};

export const UserEvents = (props: Props) => {
  const { userId } = props;
  const helper = new ColumnHelper<InternalUserEvent>();
  const api = useApi();
  const [params, setParams] = useState<CommonParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['timestamp', 'descend']],
  });

  const queryResults = useQuery(
    USER_EVENTS_LIST({
      userId,
    }),
    async () => {
      return await api.getEventsList({
        userId: userId,
        page: params.page,
        pageSize: params.pageSize,
        sortField: params.sort[0]?.[0],
        sortOrder: params.sort[0]?.[1] as SortOrder,
      });
    },
  );

  const columns = helper.list([
    helper.simple({
      title: 'Event ID',
      key: 'eventId',
      type: ID,
      defaultWidth: 300,
    }),
    helper.simple({
      title: 'Event time',
      key: 'timestamp',
      type: DATE_TIME,
    }),
    helper.simple({
      title: 'Description',
      key: 'eventDescription',
      defaultWidth: 300,
    }),
    helper.simple({
      title: 'Reason',
      key: 'reason',
      defaultWidth: 300,
    }),
  ]);
  return (
    <Card.Root className={s.userEventsRoot}>
      <QueryResultsTable
        columns={columns}
        queryResults={queryResults}
        params={params}
        onChangeParams={setParams}
        rowKey="eventId"
      />
    </Card.Root>
  );
};
