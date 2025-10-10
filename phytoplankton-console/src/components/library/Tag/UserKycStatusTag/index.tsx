import React from 'react';
import Tag from '../index';
import { KYCStatusDetails } from '@/apis';
import { humanizeKYCStatus } from '@/components/utils/humanizeKYCStatus';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  kycStatusDetails: KYCStatusDetails;
}

export default function UserKycStatusTag(props: Props) {
  const { kycStatusDetails } = props;
  const settings = useSettings();
  return (
    <Tag>
      {kycStatusDetails.status &&
        humanizeKYCStatus(kycStatusDetails.status, settings.kycStatusAlias)}
      {kycStatusDetails.reason && ` (${kycStatusDetails.reason})`}
    </Tag>
  );
}
