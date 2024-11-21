import React from 'react';
import { Tag as ApiTag } from '@/apis/models/Tag';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';

interface Props {
  tags: ApiTag[];
  hideTitle?: boolean;
}

export default function Tags(props: Props) {
  const { tags, hideTitle } = props;

  return (
    <EntityPropertiesCard
      title={!hideTitle ? 'Tags' : undefined}
      items={tags?.map((tag: ApiTag) => ({ label: tag.key, value: tag.value })) ?? []}
    />
  );
}
