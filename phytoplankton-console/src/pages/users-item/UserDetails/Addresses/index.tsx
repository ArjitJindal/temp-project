import React from 'react';
import { Divider } from 'antd';
import s from './index.module.less';
import { Address as ApiAddress, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import Address from '@/components/ui/Address';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
}

export default function Addresses(props: Props) {
  const { user } = props;
  return (
    <span>
      <div className={s.fields}>
        {user?.type === 'CONSUMER'
          ? user?.contactDetails?.addresses?.map((address: ApiAddress) => (
              <>
                <Address address={address} />
                <Divider />
              </>
            ))
          : user?.legalEntity?.contactDetails?.addresses?.map((address: ApiAddress) => (
              <>
                <Address address={address} />
                <Divider />
              </>
            ))}
      </div>
    </span>
  );
}
