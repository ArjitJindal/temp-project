import { useMemo, useState } from 'react';
import s from './index.module.less';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { FreshdeskTicketConversation } from '@/apis/models/FreshdeskTicketConversation';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { getAvatarText } from '@/utils/user-utils';
import { getUserName } from '@/utils/api/users';

interface Props {
  conversations: Array<FreshdeskTicketConversation>;
  user?: InternalConsumerUser | InternalBusinessUser;
}

export default function TicketConversation(props: Props) {
  const { conversations, user } = props;
  const [expandedEmails, setExpandedEmails] = useState<number[]>([]);

  const avatarText = useMemo(() => getAvatarText(user), [user]);

  const getCcEmailCount = (emails: Array<string> | undefined) => {
    if (!emails || emails === undefined) {
      return 0;
    }

    return emails.length;
  };

  const clearMarkdown = (text: string) => text.replace(/\r\n/g, '\n').replace(/\n{1}/g, '\n\n');

  return (
    <>
      {conversations.map((item, key) => (
        <div className={s.root} key={key}>
          <div className={s.header}>
            <div className={s.left}>
              <div className={s.avatar}>
                {item.from_email?.includes('support@flagright') ? 'F' : avatarText}
              </div>
              <div className={s.commentHeader}>
                <span className={s.bold}>
                  {item.from_email?.includes('support@flagright') ? 'Flagright' : getUserName(user)}
                </span>
                <div className={s.emailContainer}>
                  {item.to_email && (
                    <div>
                      <span className={s.greyText}>to:</span>
                      <span className={s.emailText}>{item.to_email},</span>
                    </div>
                  )}
                  {item.cc_emails && item.cc_emails.length > 0 && (
                    <div>
                      <span className={s.greyText}>CC:</span>
                      {expandedEmails.includes(key) || item.cc_emails.length <= 2 ? (
                        item.cc_emails.map((email, i) => (
                          <span className={s.emailText} key={i}>
                            {email}
                            {i < getCcEmailCount(item.cc_emails) - 1 ? ', ' : ''}
                          </span>
                        ))
                      ) : (
                        <>
                          <span className={s.emailText}>
                            {item.cc_emails[0]}, {item.cc_emails[1]}
                          </span>
                          <button
                            className={s.expandButton}
                            onClick={() => setExpandedEmails([...expandedEmails, key])}
                          >
                            {` (+${item.cc_emails.length - 2})`}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <span className={s.greyText}>
              {dayjs(item.created_at).format(DEFAULT_DATE_TIME_FORMAT)}
            </span>
          </div>
          <div className={s.emailBody}>
            {item && <MarkdownViewer value={clearMarkdown(item.body_text || '')} />}
          </div>
        </div>
      ))}
    </>
  );
}
