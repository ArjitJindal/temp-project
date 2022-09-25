import React from 'react';
import { Divider } from 'antd';
import s from './index.module.less';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
}

export default function Addresses(props: Props) {
  const { user } = props;
  return (
    <span>
      <div className={s.fields}>
        <div>
          {user.type === 'CONSUMER'
            ? user.contactDetails?.addresses?.map(() => {
                const addressLines = user.contactDetails?.addresses?.[0];
                const city = user.contactDetails?.addresses?.[2];
                const country = user.contactDetails?.addresses?.[4];
                return (
                  <>
                    <div className={s.items}>{addressLines}</div>
                    <div>
                      {city}
                      {''} {country}
                      {''} {<Divider />}
                    </div>
                  </>
                );
              })
            : user.legalEntity?.contactDetails?.addresses?.map(() => {
                const addressLines = user.legalEntity?.contactDetails?.addresses?.[0];
                const city = user.legalEntity?.contactDetails?.addresses?.[2];
                const country = user.legalEntity?.contactDetails?.addresses?.[4];
                return (
                  <>
                    <div className={s.items}>{addressLines}</div>
                    <div>
                      {city}
                      {''} {country}
                      {''} {<Divider />}
                    </div>
                  </>
                );
              })}
        </div>
      </div>
    </span>
  );
}
