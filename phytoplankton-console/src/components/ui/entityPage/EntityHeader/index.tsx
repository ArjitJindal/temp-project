import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Breadcrumbs, { BreadcrumbItem } from './Breadcrumbs';
import Sticky from '@/components/ui/Sticky';
import * as Card from '@/components/ui/Card';

interface Props {
  stickyElRef?: React.RefCallback<HTMLDivElement>;
  breadcrumbItems: BreadcrumbItem[];
  chips?: React.ReactNode[];
  buttons?: React.ReactNode[];
  subHeader?: React.ReactNode;
}

export default function EntityHeader(props: Props) {
  const { chips, breadcrumbItems, buttons, subHeader, stickyElRef } = props;

  return (
    <Card.Section className={cn(s.root)}>
      <Sticky>
        {(isSticky) => (
          <div
            className={cn(s.main, isSticky && s.isSticky)}
            ref={isSticky ? stickyElRef : undefined}
          >
            <div className={s.breadcrumbs}>
              <Breadcrumbs items={breadcrumbItems} />
              {chips != null && chips.length > 0 && (
                <>
                  <div className={s.breadcrumbsSeparator} />
                  <div className={s.chips}>
                    {chips?.map((chip, i) => (
                      <React.Fragment key={i}>{chip}</React.Fragment>
                    ))}
                  </div>
                </>
              )}
            </div>
            {buttons && <div className={s.buttons}>{buttons}</div>}
          </div>
        )}
      </Sticky>

      {subHeader && <div className={s.subHeader}>{subHeader}</div>}
    </Card.Section>
  );
}
