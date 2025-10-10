import React from 'react';
import { InternalBusinessUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';

interface Props {
  user: InternalBusinessUser;
}

export default function MerchantCategoryCode(props: Props) {
  const { user } = props;

  return (
    <EntityPropertiesCard
      title={'Merchant category code (MCC)'}
      items={[
        { label: 'Code', value: user.mccDetails?.code },
        { label: 'Description', value: user.mccDetails?.description },
      ]}
    />
  );
}
