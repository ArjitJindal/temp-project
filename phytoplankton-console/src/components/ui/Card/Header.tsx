import React from 'react';
import cn from 'clsx';
import Section from './Section';
import s from './index.module.less';

export interface HeaderSettings {
  title: string;
  link?: any;
}

interface Props {
  header: HeaderSettings;
  link?: any;
}

export default function Header(props: Props) {
  const { header, link } = props;
  const { title } = header;
  return (
    <Section>
      <div className={cn(s.header, s.isCollapsable)}>
        <h3 className={s.title}>{title}</h3>
        {link}
      </div>
    </Section>
  );
}
