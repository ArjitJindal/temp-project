import React from 'react';
import s from './index.module.less';
import { InternalConsumerUser } from '@/apis';
import * as Form from '@/components/ui/Form';

interface Props {
  user: InternalConsumerUser;
}

export default function PlaceOfBirth(props: Props) {
  const { user } = props;
  return (
    <div className={s.placeOfBirth}>
      <div className={s.inner}>
        <Form.Layout.Label title="City">
          {user.userDetails?.placeOfBirth?.city ?? ''}
        </Form.Layout.Label>

        <Form.Layout.Label title="State">
          {user.userDetails?.placeOfBirth?.state ?? ''}
        </Form.Layout.Label>

        <Form.Layout.Label title="Country">
          {user.userDetails?.placeOfBirth?.country ?? ''}
        </Form.Layout.Label>
      </div>
    </div>
  );
}
