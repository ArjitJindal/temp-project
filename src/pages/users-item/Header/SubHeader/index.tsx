import React from 'react';
import UserManualRiskPanel from '../../UserDetails/UserManualRiskPanel';
import KycStatusEditor from '../../UserDetails/KycStatusEditor';
import UserStateEditor from '../../UserDetails/UserStateEditor';
import KycRiskDisplay from '../../UserDetails/KycRiskDisplay';
import DynamicRiskDisplay from '../../UserDetails/DynamicRiskDisplay';
import s from './index.module.less';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import Spam2LineIcon from '@/components/ui/icons/Remix/system/spam-2-line.react.svg';
import Calendar2LineIcon from '@/components/ui/icons/Remix/business/calendar-2-line.react.svg';
import HospitalIcon from '@/components/ui/icons/Remix/buildings/hospital-line.react.svg';
import * as Form from '@/components/ui/Form';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
}

export default function SubHeader(props: Props) {
  const { user } = props;
  const userId = user.userId;

  return (
    <div className={s.root}>
      <div className={s.items}>
        <Feature name="PULSE">
          <Form.Layout.Label icon={<Spam2LineIcon />} title={'CRA Risk Level'}>
            <UserManualRiskPanel userId={userId} />
          </Form.Layout.Label>
        </Feature>
        <div className={s.status}>
          <Form.Layout.Label icon={<Calendar2LineIcon />} title={'KYC Status'}>
            <KycStatusEditor user={user} />
          </Form.Layout.Label>
          <Form.Layout.Label icon={<Calendar2LineIcon />} title={'User Status'}>
            <UserStateEditor user={user} />
          </Form.Layout.Label>
        </div>
        <div>
          <Feature name="PULSE_KRS_CALCULATION">
            <Form.Layout.Label icon={<HospitalIcon />} title={'KYC Risk Score'}>
              <KycRiskDisplay userId={user.userId} />
            </Form.Layout.Label>
          </Feature>
        </div>
        <div>
          <Feature name="PULSE_ARS_CALCULATION">
            <Form.Layout.Label icon={<HospitalIcon />} title={'Customer risk assessment'}>
              <DynamicRiskDisplay userId={user.userId} />
            </Form.Layout.Label>
          </Feature>
        </div>
      </div>
    </div>
  );
}
