import { useState } from 'react';
import { Empty } from 'antd';
import ScopeSelector from './ScopeSelector';
import Summary from './Summary';
import Tasks from './Tasks';
import s from './index.module.less';
import Emails from './Emails';
import Notes from './Notes';
import Tickets from './Tickets';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import {
  CrmAccountResponse,
  CrmGetResponse,
  InternalBusinessUser,
  InternalConsumerUser,
} from '@/apis';
import { CRM_ACCOUNT, CRM_RECORDS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import { CrmModelType } from '@/apis/models/CrmModelType';
interface Props {
  userId: string;
  userEmail?: string;
  model?: CrmModelType;
  user?: InternalConsumerUser | InternalBusinessUser;
}

export default function CRMMonitoring(props: Props) {
  const hasFreshdeskFeature = useFeatureEnabled('CRM_FRESHDESK');

  const { userId, userEmail, user, model } = props;

  const [selectedSection, setSelectedSection] = useState(
    hasFreshdeskFeature ? 'TICKETS' : 'SUMMARY',
  );

  const api = useApi();

  const { data: crmData } = useQuery<CrmAccountResponse | CrmGetResponse>(
    hasFreshdeskFeature
      ? CRM_RECORDS(userEmail ?? ' ', model ?? 'FreshDeskTicket', 1, DEFAULT_PAGE_SIZE, 'ascend')
      : CRM_ACCOUNT(userId),

    async () => {
      if (!hasFreshdeskFeature) {
        return api.getCrmAccount({ userId });
      }
      return api.getCrmTickets({
        model: model ?? 'FreshDeskTicket',
        email: userEmail ?? ' ',
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        sortOrder: 'ascend',
      });
    },
  );

  const renderEmptyComponent = () => {
    return (
      <Card.Root className={s.root}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card.Root>
    );
  };

  const renderFreshdeskComponent = (crmTickets: CrmGetResponse) => {
    return (
      <>
        <Card.Root className={s.root}>
          {crmTickets.count !== 0 && (
            <Card.Section>
              <ScopeSelector
                selectedSection={selectedSection}
                setSelectedSection={setSelectedSection}
                count={{
                  emails: crmTickets.count ?? 0,
                }}
              />
              {selectedSection === 'TICKETS' && (
                <Tickets items={crmTickets.items ?? []} user={user} model={model} />
              )}
            </Card.Section>
          )}
          {crmTickets.count === 0 && renderEmptyComponent()}
        </Card.Root>
      </>
    );
  };

  const renderDemoDataComponent = (crmResponse: CrmAccountResponse) => {
    return (
      <Card.Root className={s.root}>
        {crmResponse && (
          <Card.Section>
            <ScopeSelector
              selectedSection={selectedSection}
              setSelectedSection={setSelectedSection}
              count={{
                emails: crmResponse.engagements.length ?? 0,
                notes: crmResponse.notes.length ?? 0,
                tasks: crmResponse.tasks.length ?? 0,
              }}
            />
            {selectedSection === 'SUMMARY' && <Summary summary={crmResponse.summary} />}
            {selectedSection === 'EMAILS' && <Emails emails={crmResponse.engagements} />}
            {selectedSection === 'TASKS' && <Tasks tasks={crmResponse.tasks} />}
            {selectedSection === 'NOTES' && <Notes notes={crmResponse.notes} />}
          </Card.Section>
        )}
        {!crmResponse && renderEmptyComponent()}
      </Card.Root>
    );
  };

  return (
    <AsyncResourceRenderer resource={crmData} renderFailed={renderEmptyComponent}>
      {hasFreshdeskFeature
        ? (crmData) => renderFreshdeskComponent(crmData as CrmGetResponse)
        : (crmData) => renderDemoDataComponent(crmData as CrmAccountResponse)}
    </AsyncResourceRenderer>
  );
}
