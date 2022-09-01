import React from 'react';
import s from './index.module.less';
import EntityId from '@/components/ui/entityPage/EntityId';
import * as Form from '@/components/ui/Form';

interface Props {
  idTitle: string;
  id: string | undefined;
  children?: React.ReactNode;
}

export default function EntityHeader(props: Props) {
  const { id, idTitle, children } = props;

  return (
    <div className={s.root}>
      <Form.Layout.Label title={idTitle}>
        <EntityId>{id}</EntityId>
      </Form.Layout.Label>
      <div className={s.items}>{children}</div>
    </div>
  );
}
