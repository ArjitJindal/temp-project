import { Collapse } from 'antd';
import { sortBy } from 'lodash';
import { PaperClipOutlined } from '@ant-design/icons';
import TicketConversation from '../TicketConversationCard';
import CompanyHeader from '../CompanyHeader';
import { getFirstConversation, hasConversations, getRemainingDays } from '../crm-ticket-util';
import s from './index.module.less';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { CRMRecord, InternalConsumerUser, InternalBusinessUser } from '@/apis';
import { CrmModelType } from '@/apis/models/CrmModelType';
interface Props {
  items: CRMRecord[];
  user?: InternalConsumerUser | InternalBusinessUser;
  model?: CrmModelType;
}

export default function Tickets(props: Props) {
  const { items, user, model } = props;

  const { Panel } = Collapse;
  return (
    <Collapse defaultActiveKey={[]} ghost>
      {sortBy(items, 'created_at')
        .reverse()
        .map((item) => (
          <Panel
            header={
              <div className={s.panel}>
                <div className={s.panelHeader}>
                  <div className={s.panelHeaderComplete}>
                    <div className={s.panelHeaderLeft}>
                      <span className={s.panelHeading}>
                        {item.data.subject ? item.data.subject : 'No subject'}
                      </span>
                      <span className={s.greyText}>
                        {item.data.updatedAt
                          ? `Last updated - ${dayjs(item.data.updatedAt).format(
                              DEFAULT_DATE_TIME_FORMAT,
                            )} (${getRemainingDays(item.data.updatedAt)})`
                          : `Created at - ${dayjs(item.data.updatedAt).format(
                              DEFAULT_DATE_TIME_FORMAT,
                            )} (${getRemainingDays(item.data.createdAt)})`}
                      </span>
                    </div>
                    <CompanyHeader
                      link={`https://flagright.freshdesk.com/support/tickets/${item.data.id}`}
                      model={model ?? 'FreshDeskTicket'}
                    />{' '}
                  </div>
                </div>
              </div>
            }
            key={item.data.id}
          >
            {hasConversations(item) && (
              <>
                <div className={s.conversations}>
                  <TicketConversation conversations={getFirstConversation(item)} user={user} />
                  <TicketConversation conversations={item.data.conversations ?? []} user={user} />
                </div>
                <div>
                  {item.data.attachments && (
                    <div className={s.attachments}>
                      {item.data.attachments.map((attachment, i) => (
                        <span style={{ cursor: 'pointer' }} key={i}>
                          <PaperClipOutlined /> {attachment.name}{' '}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </Panel>
        ))}
    </Collapse>
  );
}
