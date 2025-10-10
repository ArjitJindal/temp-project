import React from 'react';
import { AccountMessage } from '@/components/AccountMessage';

export const SuspendedAccount: React.FC = () => (
  <AccountMessage
    title="Account suspended"
    message="Your account has been suspended due to overdue invoices and/or violating the terms of the Master Services Agreement."
  />
);
