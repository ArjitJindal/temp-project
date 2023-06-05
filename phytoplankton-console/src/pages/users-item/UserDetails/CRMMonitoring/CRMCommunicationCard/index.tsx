import _ from 'lodash';
import { PaperClipOutlined } from '@ant-design/icons';
import CompanyHeader from '../CompanyHeader';
import { getFormatedDate } from './GetFormatedDate';
import styles from './index.module.less';
import { SalesforceAccountResponseComments } from '@/apis';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';

interface Props {
  title?: string;
  body?: string;
  to?: string[];
  name?: string;
  createdAt?: string;
  link?: string;
  userId?: string;
  tab: string;
  replies?: Array<SalesforceAccountResponseComments>;
  attachments?: string[];
}

export default function CRMCommunicationCard(props: Props) {
  const { title, body, to, name, createdAt, link, tab, replies, attachments } = props;
  const date = createdAt ? getFormatedDate(createdAt) : '';
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.left}>
          <div className={styles.avatar}>{name ? name[0].toUpperCase() : 'N'}</div>
          <div className={styles.commentHeader}>
            <span className={styles.bold}>{name ?? 'No name'}</span>
            {tab === 'comments' && <span className={styles.greyText}>Edited on: {date}</span>}
            {tab === 'notes' && <span className={styles.greyText}>Created on: {date}</span>}
            {tab === 'emails' && (
              <span className={styles.greyText}>
                to{' '}
                {to?.map((receiver) => (
                  <a>{receiver}, </a>
                ))}
              </span>
            )}
          </div>
        </div>
        {link && <CompanyHeader link={link} />}
      </div>
      {title && <div className={styles.bold}>{title}</div>}
      <div className={styles.body}>
        <MarkdownViewer value={body as string} />
      </div>
      {attachments && (
        <div className={styles.attachments}>
          {attachments.map((attachment, i) => (
            <a href="#">
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
      {replies && (
        <div className={styles.replies}>
          <span>{replies.length} replies</span>
          <div className={styles.repliesContainer}>
            {_.sortBy(replies, 'createdAt')
              .reverse()
              .map((reply, i) => (
                <CRMCommunicationCard
                  key={`comments-${i}`}
                  body={reply?.body}
                  name={reply?.user}
                  createdAt={reply?.createdAt}
                  link={reply?.link}
                  tab="comments"
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
