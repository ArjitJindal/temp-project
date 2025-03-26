import { PaperClipOutlined } from '@ant-design/icons';
import CompanyHeader from '../CompanyHeader';
import styles from './index.module.less';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';

interface Props {
  title?: string;
  body?: string;
  to?: string[];
  name?: string;
  createdAt?: number;
  link?: string;
  userId?: string;
  tab: string;
  attachments?: string[];
}

export default function CRMCommunicationCard(props: Props) {
  const { title, body, to, name, createdAt, link, tab, attachments } = props;
  const date = createdAt ? dayjs(createdAt).format(DEFAULT_DATE_TIME_FORMAT) : '';
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.left}>
          <div className={styles.avatar}>{name ? name[0].toUpperCase() : 'N'}</div>
          <div className={styles.commentHeader}>
            <span className={styles.bold}>{name ?? 'No name'}</span>
            {tab === 'tasks' && <span className={styles.greyText}>Edited on: {date}</span>}
            {tab === 'notes' && <span className={styles.greyText}>Created at: {date}</span>}
            {tab === 'emails' && (
              <span className={styles.greyText}>
                to{' '}
                {to?.map((receiver, index) => (
                  <a key={index}>{receiver}, </a>
                ))}
              </span>
            )}
          </div>
        </div>
        {link && <CompanyHeader link={link} crmName="FRESHDESK" />}
      </div>
      {title && <div className={styles.bold}>{title}</div>}
      <div className={styles.body}>{body && <MarkdownViewer value={body} />}</div>
      {attachments && (
        <div className={styles.attachments}>
          {attachments.map((attachment, i) => (
            <a href="#" key={i}>
              {' '}
              <PaperClipOutlined /> Attachment {i}{' '}
            </a>
          ))}
        </div>
      )}
      {tab === 'notes' && (
        <div className={styles.greyText}>
          Last modified - {date} AM by {name}
        </div>
      )}
    </div>
  );
}
