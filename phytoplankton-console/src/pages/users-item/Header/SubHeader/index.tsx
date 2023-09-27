import UserManualRiskPanel from '../../UserDetails/UserManualRiskPanel';
import KycStatusEditor from '../../UserDetails/KYCStatusEditor';
import UserStateEditor from '../../UserDetails/UserStateEditor';
import KycRiskDisplay from '../../UserDetails/KycRiskDisplay';
import DynamicRiskDisplay from '../../UserDetails/DynamicRiskDisplay';
import s from './index.module.less';
import { Comment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import Spam2LineIcon from '@/components/ui/icons/Remix/system/spam-2-line.react.svg';
import * as Form from '@/components/ui/Form';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import AIRiskDisplay from '@/components/ui/AIRiskDisplay';
import { MerchantMonitoringToggle } from '@/components/MerchantMonitoringToggle';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
  onNewComment: (comment: Comment) => void;
}

export default function SubHeader(props: Props) {
  const { user, onNewComment } = props;
  const userId = user.userId;

  return (
    <div className={s.root}>
      <div className={s.items}>
        <Feature name="RISK_LEVELS">
          <Form.Layout.Label orientation="horizontal" icon={<Spam2LineIcon />} title={'Risk level'}>
            <UserManualRiskPanel userId={userId} />
          </Form.Layout.Label>
        </Feature>
        <div className={s['row-items']}>
          <KycStatusEditor onNewComment={onNewComment} title={'KYC status'} user={user} />
          <UserStateEditor onNewComment={onNewComment} title={'User status'} user={user} />
          {user.type === 'BUSINESS' && (
            <Feature name="MERCHANT_MONITORING">
              <MerchantMonitoringToggle
                userId={userId}
                isMonitoring={user.isMonitoringEnabled ?? false}
              />
            </Feature>
          )}
        </div>
      </div>
      <Feature name="RISK_SCORING">
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
