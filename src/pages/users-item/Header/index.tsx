import UserManualRiskPanel from '../UserDetails/UserManualRiskPanel';
import KycStatusEditor from '../UserDetails/KycStatusEditor';
import UserStateEditor from '../UserDetails/UserStateEditor';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import Spam2LineIcon from '@/components/ui/icons/Remix/system/spam-2-line.react.svg';
import Calendar2LineIcon from '@/components/ui/icons/Remix/business/calendar-2-line.react.svg';
import * as Form from '@/components/ui/Form';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import UserIdNameCard from '@/components/ui/UserIdNameCard';

export default function Header(props: { user: InternalConsumerUser | InternalBusinessUser }) {
  const { user } = props;
  const userId = user.userId;
  return (
    <>
      <Card.Column className={s.root}>
        <UserIdNameCard user={user} />
      </Card.Column>
      <div className={s.items}>
        <Feature name="PULSE_MANUAL_USER_RISK_LEVEL">
          <Form.Layout.Label icon={<Spam2LineIcon />} title={'Risk Level'}>
            <UserManualRiskPanel userId={userId} />
          </Form.Layout.Label>
        </Feature>
        <Form.Layout.Label icon={<Calendar2LineIcon />} title={'KYC Status'}>
          <KycStatusEditor user={user} />
        </Form.Layout.Label>
        <Form.Layout.Label icon={<Calendar2LineIcon />} title={'User Status'}>
          <UserStateEditor user={user} />
        </Form.Layout.Label>
      </div>
    </>
  );
}
