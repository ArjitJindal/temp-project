import React from 'react';
import cn from 'clsx';
import Section from './Section';
import s from './index.module.less';
import ExpandIcon from '@/components/library/ExpandIcon';

export interface HeaderSettings {
  title: string;
  titleSize?: 'DEFAULT' | 'SMALL';
  link?: React.ReactNode;
}

interface Props extends HeaderSettings {
  isCollapsable?: boolean;
  isCollapsed?: boolean;
  setCollapsed?: (isCollapsed: boolean) => void;
}

export default function Header(props: Props) {
  const {
    title,
    titleSize = 'DEFAULT',
    isCollapsable = false,
    isCollapsed,
    setCollapsed,
    link,
  } = props;
  return (
    <Section>
      <div
        className={cn(s.header, isCollapsable && s.isCollapsable)}
        onClick={
          isCollapsable && setCollapsed
            ? () => {
                setCollapsed(!isCollapsed);
              }
            : undefined
        }
      >
        {isCollapsable && <ExpandIcon isExpanded={!isCollapsed} color="BLUE" size="BIG" />}
        <h3 className={cn(s.title, s[`size-${titleSize}`])}>{title}</h3>
        {link}
      </div>
    </Section>
  );
}
