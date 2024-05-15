import React from 'react';
import s from './index.module.less';
import { Address as ApiAddress } from '@/apis';

interface Props {
  address: ApiAddress;
}

export default function Address({ address }: Props) {
  const addressLines = address?.addressLines;
  const city = address?.city;
  const country = address?.country;
  const postcode = address?.postcode;
  return (
    <>
      <div className={s.details}>
        <div className={s.items}>{addressLines?.join(', ')}</div>
        <div>
          {city} {postcode}
          {''} {country}
        </div>
      </div>
    </>
  );
}
