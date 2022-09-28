import React from 'react';
import { Divider } from 'antd';
import s from './index.module.less';
import { Address, InternalBusinessUser, InternalConsumerUser } from '@/apis';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
}

export default function Addresses(props: Props) {
  const { user } = props;
  return (
    <span>
      <div className={s.fields}>
        {user.type === 'CONSUMER'
          ? user.contactDetails?.addresses?.map((address: Address) => {
              const addressLines = address.addressLines;
              const city = address.city;
              const country = address.country;
              return (
                <>
                  <div className={s.detail}>
                    <div className={s.items}>{addressLines.join(', ')}</div>
                    <div>
                      {city}
                      {''} {country}
                    </div>
                  </div>
                  <Divider />
                </>
              );
            })
          : user.legalEntity?.contactDetails?.addresses?.map((address: Address) => {
              const addressLines = address.addressLines;
              const city = address.city;
              const country = address.country;
              return (
                <>
                  <div className={s.detail}>
                    <div className={s.items}>{addressLines.join(', ')}</div>
                    <div>
                      {city}
                      {''} {country}
                    </div>
                  </div>
                  <Divider />
                </>
              );
            })}
      </div>
    </span>
  );
}
