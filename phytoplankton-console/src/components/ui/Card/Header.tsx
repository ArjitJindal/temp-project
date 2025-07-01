import React from 'react';
import cn from 'clsx';
import Section from './Section';
import s from './index.module.less';
import ExpandIcon from '@/components/library/ExpandIcon';

export interface HeaderSettings {
  title: string | React.ReactNode;
  titleSize?: 'DEFAULT' | 'SMALL';
  link?: React.ReactNode;
}

interface Props extends HeaderSettings {
  isCollapsable?: boolean;
  isCollapsed?: boolean;
  setCollapsed?: (isCollapsed: boolean) => void;
  isInvalid?: boolean;
  testId?: string;
  className?: string;
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
    testId,
    className,
  } = props;

  return (
    <Section>
      <div
        className={cn(
          s.header,
          isCollapsable && s.isCollapsable,
          className,
          isInvalid && s.isInvalid,
        )}
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
        {typeof title === 'string' ? (
          <h3
            className={cn(s.title, s[`size-${titleSize}`])}
            data-cy={testId}
            data-sentry-allow={true}
          >
            {title}
          </h3>
        ) : (
          <div className={s.complexTitle}>{title}</div>
        )}

        {link}
      </div>
    </Section>
  );
}
