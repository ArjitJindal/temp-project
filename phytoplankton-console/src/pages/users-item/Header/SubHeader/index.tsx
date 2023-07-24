import React from 'react';
import UserManualRiskPanel from '../../UserDetails/UserManualRiskPanel';
import KycStatusEditor from '../../UserDetails/KycStatusEditor';
import UserStateEditor from '../../UserDetails/UserStateEditor';
import KycRiskDisplay from '../../UserDetails/KycRiskDisplay';
import DynamicRiskDisplay from '../../UserDetails/DynamicRiskDisplay';
import s from './index.module.less';

import KycIcon from './kyc-icon.react.svg';
import UserStatusIcon from './user-status-icon.react.svg';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import Spam2LineIcon from '@/components/ui/icons/Remix/system/spam-2-line.react.svg';
import * as Form from '@/components/ui/Form';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import AIRiskDisplay from '@/components/ui/AIRiskDisplay';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
}

export default function SubHeader(props: Props) {
  const { user } = props;
  const userId = user.userId;

  return (
    <div className={s.root}>
      <div className={s.items}>
        <Form.Layout.Label orientation="horizontal" icon={<KycIcon />} title={'KYC status'}>
          <KycStatusEditor user={user} />
        </Form.Layout.Label>
        <Form.Layout.Label orientation="horizontal" icon={<UserStatusIcon />} title={'User status'}>
          <UserStateEditor user={user} />
        </Form.Layout.Label>
        <Feature name="PULSE">
          <Form.Layout.Label orientation="horizontal" icon={<Spam2LineIcon />} title={'Risk level'}>
            <UserManualRiskPanel userId={userId} />
          </Form.Layout.Label>
        </Feature>
      </div>
      <Feature name="PULSE">
        <div className={s.risks}>
          <KycRiskDisplay userId={user.userId} />
          <DynamicRiskDisplay userId={user.userId} />
          <Feature name="MACHINE_LEARNING_DEMO">
            <AIRiskDisplay />
          </Feature>
        </div>
      </Feature>
    </div>
  );
}
