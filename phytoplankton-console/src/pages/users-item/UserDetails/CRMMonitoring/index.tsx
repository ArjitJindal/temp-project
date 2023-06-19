import { useState } from 'react';
import { Empty } from 'antd';
import ScopeSelector from './ScopeSelector';
import Summary from './Summary';
import Comments from './Comments';
import s from './index.module.less';
import Emails from './Emails';
import Notes from './Notes';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SalesforceAccountResponse } from '@/apis';
import { SALESFORCE_ACCOUNT } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';

interface Props {
  userId: string;
}

export default function CRMMonitoring(props: Props) {
  const { userId } = props;
  const [selectedSection, setSelectedSection] = useState('SUMMARY');
  const api = useApi();

  const { data: salesforceResource } = useQuery<SalesforceAccountResponse>(
    SALESFORCE_ACCOUNT(userId),
    async () => {
      return api.getSalesforceAccount({ userId });
    },
  );
  return (
    <AsyncResourceRenderer
      resource={salesforceResource}
      renderFailed={() => (
        <Card.Root className={s.root}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card.Root>
      )}
    >
      {(salesforceResponse) => (
        <Card.Root className={s.root}>
          <Card.Section>
            <ScopeSelector
              selectedSection={selectedSection}
              setSelectedSection={setSelectedSection}
              count={{
                email: salesforceResponse?.emails ? salesforceResponse.emails.length : 0,
                notes: salesforceResponse?.notes ? salesforceResponse.notes.length : 0,
                comments: salesforceResponse?.comments ? salesforceResponse.comments.length : 0,
              }}
            />
            {salesforceResponse?.account?.summary && selectedSection === 'SUMMARY' && (
              <Summary summary={salesforceResponse.account.summary} />
            )}
            {salesforceResponse?.emails && selectedSection === 'EMAILS' && (
              <Emails emails={salesforceResponse.emails} />
            )}
            {salesforceResponse?.comments && selectedSection === 'COMMENTS' && (
              <Comments comments={salesforceResponse.comments} />
            )}
            {salesforceResponse?.notes && selectedSection === 'NOTES' && (
              <Notes notes={salesforceResponse.notes} />
            )}
          </Card.Section>
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
}
