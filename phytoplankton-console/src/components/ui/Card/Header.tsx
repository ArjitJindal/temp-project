import React from 'react';
import cn from 'clsx';
import Section from './Section';
import s from './index.module.less';
import ExpandIcon from '@/components/library/ExpandIcon';

export interface HeaderSettings {
  title: string;
  collapsableKey?: string;
  collapsable?: boolean;
  link?: any;
}

interface Props {
  header: HeaderSettings;
  link?: any;
  isCollapsed: boolean;
  setCollapsed: (isCollapsed: boolean) => void;
}

export default function Header(props: Props) {
  const { header, isCollapsed, setCollapsed, link } = props;
  const { title, collapsable = true } = header;
  return (
    <Section>
      <div
        className={cn(s.header, collapsable && s.isCollapsable)}
        onClick={() => {
          if (collapsable) {
            setCollapsed(!isCollapsed);
          }
        }}
      >
        {collapsable && <ExpandIcon isExpanded={!isCollapsed} color="BLUE" size="BIG" />}
        <h3 className={s.title}>{title}</h3>
        {link}
      </div>
    </Section>
  );
}
