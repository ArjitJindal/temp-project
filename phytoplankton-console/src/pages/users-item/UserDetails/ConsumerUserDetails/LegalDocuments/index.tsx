import React, { useState } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { LegalDocument } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import { formatConsumerName } from '@/utils/api/users';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import TagList from '@/components/library/Tag/TagList';
import KeyValueTag from '@/components/library/Tag/KeyValueTag';

interface Props {
  legalDocuments?: LegalDocument[];
}

export default function LegalDocuments(props: Props) {
  const { legalDocuments } = props;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = legalDocuments?.[activeIndex];
  if (!legalDocuments || legalDocuments.length == 0) {
    return <EntityPropertiesCard title={'Legal documents'} />;
  }
  return (
    <EntityPropertiesCard
      title={`Legal documents (${legalDocuments ? legalDocuments.length : 0})`}
      extraControls={
        legalDocuments &&
        legalDocuments.length > 1 && (
          <div className={s.navigation}>
            <ArrowLeftSLineIcon
              className={cn(s.navigationButton, activeIndex === 0 && s.isDisabled)}
              onClick={() => {
                setActiveIndex((x) => x - 1);
              }}
            />
            {activeIndex + 1}/{legalDocuments.length}
            <ArrowRightSLineIcon
              className={cn(
                s.navigationButton,
                activeIndex >= legalDocuments.length - 1 && s.isDisabled,
              )}
              onClick={() => {
                setActiveIndex((x) => x + 1);
              }}
            />
          </div>
        )
      }
      items={[
        { label: 'Type', value: activeItem?.documentType },
        { label: 'Number', value: activeItem?.documentNumber },
        {
          label: 'Name',
          value: activeItem?.nameOnDocument && formatConsumerName(activeItem?.nameOnDocument),
        },
        {
          label: 'Issued country',
          value: <CountryDisplay isoCode={activeItem?.documentIssuedCountry} />,
        },
        {
          label: 'Date of issue',
          value:
            activeItem?.documentIssuedDate &&
            dayjs(activeItem?.documentIssuedDate).format(DEFAULT_DATE_TIME_FORMAT),
        },
        {
          label: 'Date of expiry',
          value:
            activeItem?.documentExpirationDate &&
            dayjs(activeItem?.documentExpirationDate).format(DEFAULT_DATE_TIME_FORMAT),
        },
        {
          label: 'Tags',
          value: activeItem?.tags?.length && (
            <TagList>
              {activeItem?.tags?.map((tag) => (
                <KeyValueTag key={tag.key} tag={tag} />
              ))}
            </TagList>
          ),
        },
      ]}
    />
  );
}
