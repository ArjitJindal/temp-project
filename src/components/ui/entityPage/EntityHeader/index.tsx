import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import EntityId from '@/components/ui/entityPage/EntityId';
import * as Form from '@/components/ui/Form';
import Sticky from '@/components/ui/Sticky';
import * as Card from '@/components/ui/Card';

interface Props {
  idTitle?: string;
  id?: string | undefined;
  tag?: React.ReactNode;
  buttons?: React.ReactNode;
  children?: React.ReactNode;
  subHeader?: React.ReactNode;
}

export default function EntityHeader(props: Props) {
  const { id, idTitle, tag, children, buttons, subHeader } = props;

  return (
    <Card.Section className={cn(s.root)}>
      <Sticky>
        {(isSticky) => (
          <div className={cn(s.main, isSticky && s.isSticky)}>
            {idTitle && (
              <Form.Layout.Label title={idTitle}>
                <EntityId>{id}</EntityId>
                {tag}
              </Form.Layout.Label>
            )}
            <div className={s.items}>{children}</div>
            {buttons && <div className={s.buttons}>{buttons}</div>}
          </div>
        )}
      </Sticky>

      {subHeader && <div className={s.subHeader}>{subHeader}</div>}
    </Card.Section>
  );
}
