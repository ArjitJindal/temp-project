import React from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import Tag from '../index';
import { KYCStatusDetails } from '@/apis';

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
