import React from 'react';
import { Tag } from 'antd';
import _ from 'lodash';
import { KYCStatusDetails } from '@/apis';

interface Props {
  kycStatusDetails: KYCStatusDetails;
}

export default function UserKycStatusTag(props: Props) {
  const { kycStatusDetails } = props;

  return (
    <Tag>
      {_.capitalize(kycStatusDetails.status)}
      {kycStatusDetails.reason && ` (${kycStatusDetails.reason})`}
    </Tag>
  );
}
