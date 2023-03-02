import React from 'react';
import cn from 'clsx';
import CollapsableIcon from '../icons/CollapsableIcon/CollapsableIcon';
import Section from './Section';
import s from './index.module.less';

export interface HeaderSettings {
  title: string;
  collapsableKey?: string;
  collapsable?: boolean;
}

interface Props {
  header: HeaderSettings;
  isCollapsed: boolean;
  setCollapsed: (isCollapsed: boolean) => void;
}

export default function Header(props: Props) {
  const { header, isCollapsed, setCollapsed } = props;
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
        {collapsable && <CollapsableIcon expanded={!isCollapsed} />}
        <h3 className={s.title}>{title}</h3>
      </div>
    </Section>
  );
}
