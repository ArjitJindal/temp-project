import React from 'react';
import BusinessIcon from './business.react.svg';
import ConsumerIcon from './consumer.react.svg';
import s from './styles.module.less';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { neverReturn } from '@/utils/lang';

interface Props {
  type: InternalBusinessUser['type'] | InternalConsumerUser['type'];
}

export default function UserTypeIcon(props: Props): JSX.Element {
  const { type } = props;
  switch (type) {
    case 'BUSINESS':
      return <BusinessIcon className={s.root} role="presentation" />;
    case 'CONSUMER':
      return <ConsumerIcon className={s.root} role="presentation" />;
  }
  return neverReturn(type, <></>);
}
