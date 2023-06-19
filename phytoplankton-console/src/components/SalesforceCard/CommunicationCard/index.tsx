import React from 'react';
import s from './index.module.less';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';
import * as Card from '@/components/ui/Card';
import { dayjs } from '@/utils/dayjs';
import OpenNewTab from '@/components/SalesforceCard/OpenNewTab.react.svg';

interface Props {
  title?: string;
  body?: string;
  to?: string[];
  name?: string;
  createdAt?: string;
  link?: string;
}

export default function CommunicationCard(props: Props) {
  const { title, to, body, name, createdAt, link } = props;
  return (
    <Card.Root>
      <div className={s.wrapper}>
        {(link || title) && (
          <Card.Section>
            <div className={s.titleContainer}>
              {<h3 className={s.title}>{title}</h3>}
              <a href={link} className={s.link} target="_blank">
                Open
                <OpenNewTab />
              </a>
              {to && <div>To: {to.join(', ')}</div>}
            </div>
            <hr className={s.divider} />
          </Card.Section>
        )}
        <Card.Section>
          <MarkdownViewer value={body as string} />
        </Card.Section>
        <Card.Section border={true}>
          Created {dayjs(createdAt).fromNow()} by {name}
        </Card.Section>
      </div>
    </Card.Root>
  );
}
