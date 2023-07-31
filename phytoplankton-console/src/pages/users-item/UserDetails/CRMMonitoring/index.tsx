import { useState } from 'react';
import { Empty } from 'antd';
import ScopeSelector from './ScopeSelector';
import Summary from './Summary';
import Tasks from './Tasks';
import s from './index.module.less';
import Emails from './Emails';
import Notes from './Notes';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { CrmAccountResponse } from '@/apis';
import { CRM_ACCOUNT } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';

interface Props {
  userId: string;
}

export default function CRMMonitoring(props: Props) {
  const { userId } = props;
  const [selectedSection, setSelectedSection] = useState('SUMMARY');
  const api = useApi();

  const { data: crmResource } = useQuery<CrmAccountResponse>(CRM_ACCOUNT(userId), async () => {
    return api.getCrmAccount({ userId });
  });
  return (
    <AsyncResourceRenderer
      resource={crmResource}
      renderFailed={() => (
        <Card.Root className={s.root}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card.Root>
      )}
    >
      {(crmResponse) => (
        <Card.Root className={s.root}>
          {crmResponse && (
            <Card.Section>
              <ScopeSelector
                selectedSection={selectedSection}
                setSelectedSection={setSelectedSection}
                count={{
                  emails: crmResponse.engagements.length,
                  notes: crmResponse.notes.length,
                  tasks: crmResponse.tasks.length,
                }}
              />
              {selectedSection === 'SUMMARY' && <Summary summary={crmResponse.summary} />}
              {selectedSection === 'EMAILS' && <Emails emails={crmResponse.engagements} />}
              {selectedSection === 'TASKS' && <Tasks tasks={crmResponse.tasks} />}
              {selectedSection === 'NOTES' && <Notes notes={crmResponse.notes} />}
            </Card.Section>
          )}
          {!crmResponse && (
            <Card.Root className={s.root}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card.Root>
          )}
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
}
