import { useState } from 'react';
import s from './index.module.less';
import { NangoConversation } from '@/apis';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { getAvatarText } from '@/utils/user-utils';

interface Props {
  conversations: Array<NangoConversation>;
}

export default function TicketConversation(props: Props) {
  const { conversations } = props;
  const [expandedEmails, setExpandedEmails] = useState<number[]>([]);

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
                {item.toEmail?.includes('support@flagright')
                  ? 'F'
                  : getAvatarText(item.toEmail || item.fromEmail || '')}
              </div>
              <div className={s.commentHeader}>
                <span className={s.bold}>
                  {item.toEmail?.includes('support@flagright')
                    ? 'Flagright'
                    : item.toEmail || item.fromEmail || ''}
                </span>
                <div className={s.emailContainer}>
                  {item.fromEmail && (
                    <div>
                      <span className={s.greyText}>to:</span>
                      <span className={s.emailText}>{item.fromEmail},</span>
                    </div>
                  )}
                  {item.ccEmails && item.ccEmails.length > 0 && (
                    <div>
                      <span className={s.greyText}>CC:</span>
                      {expandedEmails.includes(key) || item.ccEmails.length <= 2 ? (
                        item.ccEmails.map((email, i) => (
                          <span className={s.emailText} key={i}>
                            {email}
                            {i < getCcEmailCount(item.ccEmails) - 1 ? ', ' : ''}
                          </span>
                        ))
                      ) : (
                        <>
                          <span className={s.emailText}>
                            {item.ccEmails[0]}, {item.ccEmails[1]}
                          </span>
                          <button
                            className={s.expandButton}
                            onClick={() => setExpandedEmails([...expandedEmails, key])}
                          >
                            {` (+${item.ccEmails.length - 2})`}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <span className={s.greyText}>
              {dayjs(item.createdAt).format(DEFAULT_DATE_TIME_FORMAT)}
            </span>
          </div>
          <div className={s.emailBody}>
            {item && <MarkdownViewer value={clearMarkdown(item.bodyText || '')} />}
          </div>
        </div>
      ))}
    </>
  );
}
