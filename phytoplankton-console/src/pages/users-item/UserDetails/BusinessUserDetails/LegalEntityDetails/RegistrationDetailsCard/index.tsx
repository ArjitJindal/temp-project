import React from 'react';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { callRender } from '@/components/library/Table/dataTypeHelpers';
import { EMAIL, EXTERNAL_LINK, FAX, PHONE } from '@/components/library/Table/standardDataTypes';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
}

export default function RegistrationDetails(props: Props) {
  const { user } = props;

  return (
    <EntityPropertiesCard
      title={'Registration details'}
      items={[
        {
          label: 'Email',
          value:
            user.type === 'CONSUMER'
              ? user.contactDetails?.emailIds?.map((x) => callRender(EMAIL, x))
              : user.legalEntity.contactDetails?.emailIds?.map((x) => callRender(EMAIL, x)),
        },
        {
          label: 'Tel.',
          value:
            user.type === 'CONSUMER'
              ? user.contactDetails?.contactNumbers?.map((x) => callRender(PHONE, x))
              : user.legalEntity.contactDetails?.contactNumbers?.map((x) => callRender(PHONE, x)),
        },
        {
          label: 'Fax',
          value:
            user.type === 'CONSUMER'
              ? user.contactDetails?.faxNumbers?.map((x) => callRender(FAX, x))
              : user.legalEntity.contactDetails?.faxNumbers?.map((x) => callRender(FAX, x)),
        },
        {
          label: 'Website',
          value:
            user.type === 'CONSUMER'
              ? user.contactDetails?.websites?.map((x) => callRender(EXTERNAL_LINK, x))
              : user.legalEntity.contactDetails?.websites?.map((x) => callRender(EXTERNAL_LINK, x)),
        },
      ]}
    />
  );
}
