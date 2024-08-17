import React, { useState } from 'react';
import s from './index.module.less';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import * as Card from '@/components/ui/Card';
import PaymentDetailsCard from '@/pages/users-item/UserDetails/SavedPaymentDetails/PaymentDetailsCard';

interface Props {
  user: InternalBusinessUser | InternalConsumerUser;
}

export function SavedPaymentDetails(prop: Props) {
  const { user } = prop;

  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  return (
    <Card.Column>
      <Card.Section>
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
      </Card.Section>
    </Card.Column>
  );
}
