import React from 'react';
import { InternalConsumerUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import CountryDisplay from '@/components/ui/CountryDisplay';

interface Props {
  user: InternalConsumerUser;
  columns?: number;
}

export default function PlaceOfBirth(props: Props) {
  const { user, columns = 1 } = props;
  return (
    <EntityPropertiesCard
      title={'Place of birth'}
      columns={columns}
      items={[
        {
          label: 'Country',
          value: <CountryDisplay isoCode={user.userDetails?.placeOfBirth?.country} />,
        },
        {
          label: 'City',
          value: <>{user.userDetails?.placeOfBirth?.city ?? '-'}</>,
        },
        {
          label: 'State',
          value: <>{user.userDetails?.placeOfBirth?.state ?? '-'}</>,
        },
      ]}
    />
  );
}
