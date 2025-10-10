import React from 'react';
import { Tag as ApiTag } from '@/apis/models/Tag';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { dayjs } from '@/utils/dayjs';
import { DATE_TIME_FORMAT } from '@/components/library/DateRangePicker/DateTimeTextInput';

interface Props {
  tags: ApiTag[];
  hideTitle?: boolean;
}

export default function Tags(props: Props) {
  const { tags, hideTitle } = props;

  return (
    <EntityPropertiesCard
      title={!hideTitle ? 'Tags' : undefined}
      items={
        tags?.map((tag: ApiTag) => ({
          label: tag.key,
          value: tag.isTimestamp ? dayjs(Number(tag.value)).format(DATE_TIME_FORMAT) : tag.value,
        })) ?? []
      }
    />
  );
}
