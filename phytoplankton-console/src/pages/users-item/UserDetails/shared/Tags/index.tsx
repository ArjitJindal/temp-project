import React from 'react';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { Tag as ApiTag } from '@/apis/models/Tag';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';

interface Props {
  user: InternalBusinessUser | InternalConsumerUser;
}

export default function Tags(props: Props) {
  const { user } = props;

  return (
    <EntityPropertiesCard
      title={'Tags'}
      items={user.tags?.map((tag: ApiTag) => ({ label: tag.key, value: tag.value })) ?? []}
    />
  );
}
