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
                        {item.subject ? item.subject : 'No subject'}
                      </span>
                      <span className={s.greyText}>
                        {item.updated_at
                          ? `Last updated - ${dayjs(item.updated_at).format(
                              DEFAULT_DATE_TIME_FORMAT,
                            )} (${getRemainingDays(item.updated_at)})`
                          : `Created at - ${dayjs(item.updated_at).format(
                              DEFAULT_DATE_TIME_FORMAT,
                            )} (${getRemainingDays(item.created_at)})`}
                      </span>
                    </div>
                    <CompanyHeader
                      link={`https://flagright.freshdesk.com/support/tickets/${item.id}`}
                      model={model ?? 'FreshDeskTicket'}
                    />{' '}
                  </div>
                </div>
              </div>
            }
            key={item.id}
          >
            {hasConversations(item) && (
              <>
                <div className={s.conversations}>
                  <TicketConversation conversations={getFirstConversation(item)} user={user} />
                  <TicketConversation conversations={item.conversations ?? []} user={user} />
                </div>
                <div>
                  {item.attachments && (
                    <div className={s.attachments}>
                      {item.attachments.map((attachment, i) => (
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
