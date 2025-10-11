import { useState } from 'react';
import { useDebounce } from 'ahooks';
import { startCase } from 'lodash';
import Tickets from '../Tickets';
import s from './styles.module.less';
import SegmentedControl from '@/components/library/SegmentedControl';
import * as Card from '@/components/ui/Card';
import Select from '@/components/library/Select';
import { CRMModelType, CRMTicket } from '@/apis';
import { getOr } from '@/utils/asyncResource';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useCrmLinkRecordMutation, useCrmRecords, useCrmSearch } from '@/hooks/api/crm';

export type Props = {
  userId: string;
};

export default function CRMRecords({ userId }: Props) {
  const [scope, setScope] = useState<CRMModelType>('TICKET');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, { wait: 500 });

  const searchResults = useCrmSearch(scope, 'FRESHDESK', debouncedSearch);

  const mutation = useCrmLinkRecordMutation(userId, scope);

  const records = getOr(searchResults.data, []);

  const queryResults = useCrmRecords({
    userId,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    modelType: scope,
    crmName: 'FRESHDESK',
    sortField: 'timestamp',
    sortOrder: 'descend',
  });

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
