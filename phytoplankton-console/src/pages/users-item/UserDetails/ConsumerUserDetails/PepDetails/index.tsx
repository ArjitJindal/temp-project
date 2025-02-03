import React, { useState } from 'react';
import {
  PepStatusLabel,
  PepStatusValue,
} from 'src/pages/users-item/UserDetails/ConsumerUserDetails/PepDetails/PepStatus';
import { InternalConsumerUser, PEPStatus } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';

interface Props {
  user: InternalConsumerUser;
  columns?: number;
}

export default function PepDetails(props: Props) {
  const { user, columns = 1 } = props;
  const [pepStatus, setPepStatus] = useState<PEPStatus[]>(user.pepStatus ?? []);
  return (
    <EntityPropertiesCard
      title={'PEP details'}
      columns={columns}
      items={[
        {
          label: (
            <PepStatusLabel
              userId={user.userId}
              pepStatus={user.pepStatus ?? []}
              updatePepStatus={setPepStatus}
            />
          ),
          value: <PepStatusValue pepStatus={pepStatus} />,
        },
      ]}
    />
  );
}
