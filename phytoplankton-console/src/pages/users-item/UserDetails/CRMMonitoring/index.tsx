import React, { lazy, Suspense } from 'react';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { useFreshdeskCrmEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { CrmModelType } from '@/apis/models/CrmModelType';

export interface Props {
  userId: string;
  userEmail?: string;
  model?: CrmModelType;
  user?: InternalConsumerUser | InternalBusinessUser;
}

const CRMData = lazy(() => import('./CRMResponse'));
const FreshDeskData = lazy(() => import('./FreshDeskResponse'));

export default function CRMMonitoring(props: Props) {
  const isFreshdeskCrm = useFreshdeskCrmEnabled();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {isFreshdeskCrm ? <FreshDeskData {...props} /> : <CRMData {...props} />}
    </Suspense>
  );
}
