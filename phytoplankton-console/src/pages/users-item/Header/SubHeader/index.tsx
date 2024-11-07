import UserManualRiskPanel from '../../UserDetails/UserManualRiskPanel';
import KycStatusEditor from '../../UserDetails/KYCStatusEditor';
import UserStateEditor from '../../UserDetails/UserStateEditor';
import KycRiskDisplay from '../../UserDetails/KycRiskDisplay';
import DynamicRiskDisplay from '../../UserDetails/DynamicRiskDisplay';
import { UserTrsRiskDisplay } from '../../UserDetails/UserTrsRiskDisplay';
import s from './index.module.less';
import { Comment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import * as Form from '@/components/ui/Form';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';

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
          <Form.Layout.Label
            orientation="horizontal"
            title={'CRA risk level'}
            tooltip={
              'Manually adjusting CRA risk level will override the user`s risk level for all future rule checks.'
            }
          >
            <>
              <UserManualRiskPanel userId={userId} />
            </>
          </Form.Layout.Label>
        </Feature>
        <div className={s['row-items']}>
          <KycStatusEditor onNewComment={onNewComment} title={'KYC status'} user={user} />
          <UserStateEditor onNewComment={onNewComment} title={'User status'} user={user} />
        </div>
      </div>
      <Feature name="RISK_SCORING">
        <div className={s.risks}>
          <KycRiskDisplay userId={user.userId} />
          <UserTrsRiskDisplay userId={user.userId} />
          <DynamicRiskDisplay userId={user.userId} />
        </div>
      </Feature>
    </div>
  );
}
