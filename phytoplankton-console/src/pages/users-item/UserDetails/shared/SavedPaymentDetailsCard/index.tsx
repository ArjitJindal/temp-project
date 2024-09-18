import React, { useState } from 'react';
import s from './index.module.less';
import PaymentDetailsCard from './PaymentDetailsCard';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';

interface Props {
  user: InternalBusinessUser | InternalConsumerUser;
}

export default function SavedPaymentDetails(prop: Props) {
  const { user } = prop;

  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  return (
    <EntityPropertiesCard title={'Saved payment details'}>
      <div className={s.root}>
        {user.savedPaymentDetails?.map((x, i) => (
          <PaymentDetailsCard
            key={i}
            paymentDetails={x}
            isExpanded={i === expandedItem}
            onExpandChange={(isExpanded) => {
              setExpandedItem(isExpanded ? i : null);
            }}
          />
        ))}
      </div>
    </EntityPropertiesCard>
  );
}
