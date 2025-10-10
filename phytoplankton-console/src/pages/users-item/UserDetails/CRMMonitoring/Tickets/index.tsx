import { Collapse } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { sortBy } from 'lodash';
import TicketConversation from '../TicketConversationCard';
import CompanyHeader from '../CompanyHeader';
import { getFirstConversation, getRemainingDays } from '../crm-ticket-util';
import s from './index.module.less';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { CrmName, CRMTicket } from '@/apis';

interface Props {
  crmName: CrmName;
  tickets: CRMTicket[];
}

export default function Tickets(props: Props) {
  const { crmName, tickets } = props;
  const { Panel } = Collapse;
  return (
    <Collapse defaultActiveKey={['1']} ghost>
      {sortBy(tickets, 'record.updatedAt').map((item, index) => (
        <Panel
          header={<Header item={item} crmName={crmName} index={index} />}
          key={index.toString()}
        >
          <TicketPanel item={item} />
        </Panel>
      ))}
    </Collapse>
  );
}

const Header = (props: { item: CRMTicket; crmName: CrmName; index: number }) => {
  const { item, crmName } = props;
  return (
    <div className={s.panel}>
      <div className={s.panelHeader}>
        <div className={s.panelHeaderComplete}>
          <div className={s.panelHeaderLeft}>
            <span className={s.panelHeading}>
              {item.record.subject ? item.record.subject : 'No subject'}
            </span>
            <span className={s.greyText}>
              {item.record.updatedAt
                ? `Last updated - ${dayjs(item.record.updatedAt).format(
                    DEFAULT_DATE_TIME_FORMAT,
                  )} (${getRemainingDays(item.record.updatedAt)})`
                : `Created at - ${dayjs(item.record.createdAt).format(
                    DEFAULT_DATE_TIME_FORMAT,
                  )} (${getRemainingDays(item.record.createdAt)})`}
            </span>
          </div>
          <CompanyHeader
            link={`https://flagright.freshdesk.com/support/tickets/${item.record.id}`}
            crmName={crmName}
          />{' '}
        </div>
      </div>
    </div>
  );
};

const TicketPanel = (props: { item: CRMTicket }) => {
  const { item } = props;

  return (
    <>
      <div className={s.conversations}>
        <TicketConversation conversations={getFirstConversation(item)} />
        <TicketConversation conversations={item.record.conversations ?? []} />
      </div>
      <div>
        {item.record.attachments && (
          <div className={s.attachments}>
            {item.record.attachments.map((attachment, i) => (
              <span style={{ cursor: 'pointer' }} key={i}>
                <PaperClipOutlined /> {attachment.name}{' '}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
