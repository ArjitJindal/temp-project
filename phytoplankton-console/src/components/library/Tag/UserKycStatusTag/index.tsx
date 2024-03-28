import React from 'react';
import Tag from '../index';
import { KYCStatusDetails } from '@/apis';
import { humanizeConstant } from '@/utils/humanize';

interface Props {
  kycStatusDetails: KYCStatusDetails;
}

export default function UserKycStatusTag(props: Props) {
  const { kycStatusDetails } = props;

  return (
    <Tag>
      {kycStatusDetails.status && humanizeConstant(kycStatusDetails.status)}
      {kycStatusDetails.reason && ` (${kycStatusDetails.reason})`}
    </Tag>
  );
}
