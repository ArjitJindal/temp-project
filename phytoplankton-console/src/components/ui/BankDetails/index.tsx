import React from 'react';
import s from './index.module.less';
import { CorrespondenceBankDetails } from '@/apis';
import KeyValueTag from '@/components/library/Tag/KeyValueTag';
import { notNullish } from '@/utils/array';

interface Props {
  bankDetails: CorrespondenceBankDetails;
}

export default function BankDetails({ bankDetails }: Props) {
  const { bankName, tags } = bankDetails;

  return (
    <div className={s.root}>
      <div>{bankName || '-'}</div>
      {tags && tags.length > 0 && (
        <div className={s.tags}>
          {tags.filter(notNullish).map((tag) => (
            <KeyValueTag key={tag.key} tag={tag} />
          ))}
        </div>
      )}
    </div>
  );
}
