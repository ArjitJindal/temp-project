import { useState } from 'react';
import { Empty } from 'antd';
import { Props } from '..';
import s from '../index.module.less';
import ScopeSelector from '../ScopeSelector';
import Tickets from '../Tickets';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { CrmGetResponse } from '@/apis';
import { CRM_RECORDS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';

const RenderEmptyComponent = () => {
  return (
    <Card.Root className={s.root}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
    </Card.Root>
  );
};
const FreshDeskData = (props: Props) => {
  const { userEmail, user, model } = props;

  const [selectedSection, setSelectedSection] = useState('TICKETS');

  const api = useApi();

  const { data: crmTickets } = useQuery<CrmGetResponse>(
    CRM_RECORDS(userEmail ?? ' ', model ?? 'FreshDeskTicket', 1, DEFAULT_PAGE_SIZE, 'ascend'),
    async () => {
      return api.getCrmTickets({
        model: model ?? 'FreshDeskTicket',
        email: userEmail ?? ' ',
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        sortOrder: 'ascend',
      });
    },
  );
  return (
    <AsyncResourceRenderer resource={crmTickets} renderFailed={() => <RenderEmptyComponent />}>
      {(data) => (
        <Card.Root className={s.root}>
          {data.count !== 0 && (
            <Card.Section>
              <ScopeSelector
                selectedSection={selectedSection}
                setSelectedSection={setSelectedSection}
                count={{
                  emails: data.count ?? 0,
                }}
              />
              {selectedSection === 'TICKETS' && (
                <Tickets items={data.items ?? []} user={user} model={model} />
              )}
            </Card.Section>
          )}
          {data.count === 0 && <RenderEmptyComponent />}
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
};

export default FreshDeskData;
