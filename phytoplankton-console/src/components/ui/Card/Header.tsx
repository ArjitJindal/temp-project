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
  isInvalid?: boolean;
}

export default function Header(props: Props) {
  const {
    title,
    titleSize = 'DEFAULT',
    isCollapsable = false,
    isInvalid = false,
    isCollapsed,
    setCollapsed,
    link,
  } = props;
  return (
    <Section>
      <div
        className={cn(s.header, isCollapsable && s.isCollapsable, isInvalid && s.isInvalid)}
        onClick={
          isCollapsable && setCollapsed
            ? () => {
                setCollapsed(!isCollapsed);
              }
            : undefined
        }
      >
        {isCollapsable && (
          <ExpandIcon isExpanded={!isCollapsed} color="BLUE" size="BIG" isInvalid={isInvalid} />
        )}
        <h3 className={cn(s.title, s[`size-${titleSize}`])}>{title}</h3>
        {link}
      </div>
    </Section>
  );
}
