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
  const state = address?.state;
  const type = address?.addressType;
  return (
    <>
      <div className={s.details}>
        <div className={s.type}>Address type: {type}</div>
        <div className={s.items}>{addressLines?.join(', ')}</div>
        <div>
          {city} {postcode}
          {''} {state}
          {''} {country}
        </div>
      </div>
    </>
  );
}
