import React from 'react';
import cn from 'clsx';
import Section from './Section';
import s from './index.module.less';
import CollapsableIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';

export interface HeaderSettings {
  title: string;
  collapsableKey?: (string | number)[];
  collapsable?: boolean;
  collapsedByDefault?: boolean;
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
        <h3 className={s.title}>{title}</h3>
        {collapsable && (
          <div className={cn(s.collapseIcon, isCollapsed && s.isCollapsed)}>
            <CollapsableIcon />
          </div>
        )}
      </div>
    </Section>
  );
}
