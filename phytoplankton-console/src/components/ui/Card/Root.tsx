import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Column from './Column';
import Header, { HeaderSettings } from './Header';

interface Props {
  disabled?: boolean;
  className?: string;
  header?: HeaderSettings;
  children: React.ReactNode;
  noBorder?: boolean;
}

const Root = (props: Props) => {
  const { disabled, className, header, children, noBorder = false } = props;

  return (
    <div className={cn(s.root, className, disabled && s.disabled, noBorder && s.noBorder)}>
      <Column>
        {header && (
          <Header
            header={{
              title: header.title,
              link: header.link,
            }}
            link={header.link}
          />
        )}
        <Column>{children}</Column>
      </Column>
    </div>
  );
};

export default Root;
