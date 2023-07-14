import React from 'react';
import * as _ from 'lodash';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import CommunicationCard from '@/components/SalesforceCard/CommunicationCard';
import { SalesforceAccountResponse } from '@/apis';
import OpenNewTab from '@/components/SalesforceCard/OpenNewTab.react.svg';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { SALESFORCE_ACCOUNT } from '@/utils/queries/keys';
import Alert from '@/components/library/Alert';
interface Props {
  userId: string;
}

const NewTab = ({ href }: { href?: string }) => (
  <a href={href} style={s.newTab} target="_blank">
    Open
    <OpenNewTab style={{ marginLeft: '5px', height: '18px', width: '18px' }} />
  </a>
);

export type Email = { id: string; body: string; userId: string; createdAt: Date };
export default function SalesForceCard(props: Props) {
  const { userId } = props;
  const api = useApi();

  const { data: salesforceResource } = useQuery<SalesforceAccountResponse>(
    SALESFORCE_ACCOUNT(userId),
    async () => {
      return api.getSalesforceAccount({ userId });
    },
  );
  return (
    <AsyncResourceRenderer resource={salesforceResource} renderFailed={() => <></>}>
      {(salesforceResponse) => (
        <>
          {salesforceResponse?.account?.summary && (
            <Card.Root
              header={{
                title: `Salesforce Summary`,
                link: <NewTab href={salesforceResponse.account?.link} />,
              }}
            >
              <Card.Section>
                {salesforceResponse.account.summary.good && (
                  <Alert type={'success'}>{salesforceResponse.account.summary.good}</Alert>
                )}
                {salesforceResponse.account.summary.neutral && (
                  <Alert type={'info'}>{salesforceResponse.account.summary.neutral}</Alert>
                )}
                {salesforceResponse.account.summary.bad && (
                  <Alert type={'warning'}>{salesforceResponse.account.summary.bad}</Alert>
                )}
              </Card.Section>
            </Card.Root>
          )}
          {salesforceResponse?.emails && (
            <Card.Root
              header={{
                title: `Salesforce Emails (${salesforceResponse?.emails.length})`,
                link: <NewTab href={salesforceResponse.account?.link} />,
              }}
              disabled={salesforceResponse?.emails.length === 0}
            >
              <Card.Section>
                {_.sortBy(salesforceResponse?.emails, 'createdAt')
                  .reverse()
                  .map((thisEmail, i) => (
                    <CommunicationCard
                      key={`email-message-${i}`}
                      name={thisEmail._from}
                      title={thisEmail.subject}
                      body={thisEmail.body}
                      createdAt={thisEmail.createdAt}
                      link={thisEmail.link}
                    />
                  ))}
              </Card.Section>
            </Card.Root>
          )}
          {salesforceResponse?.comments && (
            <Card.Root
              header={{
                title: `Salesforce Comments (${salesforceResponse?.comments.length})`,
                link: <NewTab href={salesforceResponse.account?.link} />,
              }}
              disabled={salesforceResponse?.comments.length === 0}
            >
              <Card.Section>
                {_.sortBy(salesforceResponse?.comments, 'createdAt')
                  .reverse()
                  .map((comment, i) => (
                    <CommunicationCard
                      key={`comments-${i}`}
                      body={comment.body}
                      name={comment.user}
                    />
                  ))}
              </Card.Section>
            </Card.Root>
          )}
          {salesforceResponse?.notes && (
            <Card.Root
              header={{
                title: `Salesforce Notes (${salesforceResponse?.notes.length})`,
                link: <NewTab href={salesforceResponse.account?.link} />,
              }}
              disabled={salesforceResponse?.notes.length === 0}
            >
              <Card.Section>
                {_.sortBy(salesforceResponse?.notes, 'createdAt')
                  .reverse()
                  .map((note, i) => (
                    <CommunicationCard
                      key={`notes-${i}`}
                      title={note.title}
                      body={note.body}
                      name={note.user}
                    />
                  ))}
              </Card.Section>
            </Card.Root>
          )}
        </>
      )}
    </AsyncResourceRenderer>
  );
}
