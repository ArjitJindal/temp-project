import { useState } from 'react';
import { Empty } from 'antd';
import { Props } from '../CRMRecords/index';
import ScopeSelector from '../ScopeSelector';
import s from '../index.module.less';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { CRM_ACCOUNT } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { CrmAccountResponse } from '@/apis';
import { makeAsyncComponent } from '@/utils/imports';

const Summary = makeAsyncComponent(() => import('../Summary'));
const Emails = makeAsyncComponent(() => import('../Emails'));
const Tasks = makeAsyncComponent(() => import('../Tasks'));
const Notes = makeAsyncComponent(() => import('../Notes'));

const ComponentLoader = ({ section, data }) => {
  let Component;

  switch (section) {
    case 'SUMMARY':
      Component = Summary;
      break;
    case 'EMAILS':
      Component = Emails;
      break;
    case 'TASKS':
      Component = Tasks;
      break;
    case 'NOTES':
      Component = Notes;
      break;
    default:
      return null; // Handle unknown sections gracefully
  }

  return <Component {...data} />;
};

const CRMData = (props: Props) => {
  const { userId } = props;

  const [selectedSection, setSelectedSection] = useState('SUMMARY');

  const api = useApi();

  const renderEmptyComponent = () => {
    return (
      <Card.Root className={s.root}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card.Root>
    );
  };

  const { data: crmResponse } = useQuery<CrmAccountResponse>(
    CRM_ACCOUNT(userId),

    async () => {
      return api.getCrmAccount({ userId });
    },
  );
  return (
    <AsyncResourceRenderer resource={crmResponse} renderFailed={renderEmptyComponent}>
      {(data) => (
        <Card.Root className={s.root}>
          {data && (
            <Card.Section>
              <ScopeSelector
                selectedSection={selectedSection}
                setSelectedSection={setSelectedSection}
                count={{
                  emails: data.engagements.length ?? 0,
                  notes: data.notes.length ?? 0,
                  tasks: data.tasks.length ?? 0,
                }}
              />
              <ComponentLoader section={selectedSection} data={data} />
            </Card.Section>
          )}
          {!data && renderEmptyComponent()}
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
};

export default CRMData;
