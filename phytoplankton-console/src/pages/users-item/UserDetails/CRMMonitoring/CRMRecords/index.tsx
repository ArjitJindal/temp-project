import { useState } from 'react';
import { useDebounce } from 'ahooks';
import { startCase } from 'lodash';
import Tickets from '../Tickets';
import s from './styles.module.less';
import SegmentedControl from '@/components/library/SegmentedControl';
import * as Card from '@/components/ui/Card';
import Select from '@/components/library/Select';
import { CRMModelType, CRMTicket } from '@/apis';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { getOr } from '@/utils/asyncResource';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { dayjs } from '@/utils/dayjs';
import { CRM_RECORDS } from '@/utils/queries/keys';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { CloseMessage, message } from '@/components/library/Message';

export type Props = {
  userId: string;
};

export default function CRMRecords({ userId }: Props) {
  const [scope, setScope] = useState<CRMModelType>('TICKET');
  const api = useApi();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, { wait: 500 });

  const searchResults = useQuery(
    ['crm-records-search', debouncedSearch],
    async () => {
      const response = await api.getCrmRecordsSearch({
        search: debouncedSearch,
        modelType: scope,
        crmName: 'FRESHDESK',
      });

      return response;
    },
    { enabled: !!search },
  );

  let messageData: CloseMessage | null = null;

  const mutation = useMutation(
    async (crmRecordId: string) => {
      return api.postCrmRecordLink({
        CRMRecordLink: {
          crmName: 'FRESHDESK',
          recordType: scope,
          id: crmRecordId,
          userId,
          timestamp: dayjs().valueOf(),
        },
      });
    },
    {
      onError: () => {
        messageData?.();
        messageData = message.fatal('Failed to link CRM record');
      },
      onSuccess: () => {
        messageData?.();
        messageData = message.info('CRM record linked successfully it will refresh shortly');
        setTimeout(() => {
          queryResults.refetch();
        }, 3000);
      },
      onMutate: () => {
        messageData?.();
        messageData = message.info('Linking CRM record...');
        setTimeout(() => {
          messageData?.();
        }, 3000);
      },
    },
  );

  const records = getOr(searchResults.data, []);

  const queryResults = useQuery(
    CRM_RECORDS(1, DEFAULT_PAGE_SIZE, 'descend', scope, 'FRESHDESK', userId),
    async () =>
      await api.getCrmRecords({
        crmName: 'FRESHDESK',
        modelType: scope,
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        sortField: 'timestamp',
        sortOrder: 'descend',
        userId,
      }),
  );

  return (
    <Card.Root>
      <Card.Section>
        <div className={s.controls}>
          <SegmentedControl<CRMModelType>
            active="TICKET"
            onChange={(newValue) => {
              setScope(newValue);
            }}
            items={[{ value: 'TICKET', label: 'Ticket' }]}
          />
          <div className={s.controlsRight}>
            <Select
              mode="SINGLE"
              size="LARGE"
              value={null}
              options={records.map((record) => ({
                value: record.id,
                label: `${record.name} - ${record.id}`,
              }))}
              placeholder={`Search and select a ${startCase(
                scope.toLowerCase(),
              )} to link to this user`}
              className={s.select}
              onSearch={setSearch}
              onChange={(value) => {
                if (value) {
                  mutation.mutate(value);
                }
              }}
            />
          </div>
        </div>
        <AsyncResourceRenderer resource={queryResults.data}>
          {(data) => {
            if (scope === 'TICKET') {
              return (
                <Tickets
                  crmName="FRESHDESK"
                  tickets={
                    data.items
                      .filter((item) => item.recordType === 'TICKET')
                      .map((item) => item.data) as CRMTicket[]
                  }
                />
              );
            }
          }}
        </AsyncResourceRenderer>
      </Card.Section>
    </Card.Root>
  );
}
