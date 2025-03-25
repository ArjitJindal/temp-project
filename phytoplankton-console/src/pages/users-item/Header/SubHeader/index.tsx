import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import UserManualRiskPanel from '../../UserDetails/UserManualRiskPanel';
import KycStatusEditor from '../../UserDetails/KYCStatusEditor';
import UserStateEditor from '../../UserDetails/UserStateEditor';
import KycRiskDisplay from '../../UserDetails/KycRiskDisplay';
import DynamicRiskDisplay from '../../UserDetails/DynamicRiskDisplay';
import { UserTrsRiskDisplay } from '../../UserDetails/UserTrsRiskDisplay';
import s from './index.module.less';
import { Comment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import * as Form from '@/components/ui/Form';
import { Feature, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { CommentType } from '@/utils/user-utils';
import { AsyncResource } from '@/utils/asyncResource';

interface Props {
  userId: string;
  userRes: AsyncResource<InternalConsumerUser | InternalBusinessUser>;
  onNewComment: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

export default function SubHeader(props: Props) {
  const { userId, userRes, onNewComment } = props;
  const settings = useSettings();

  return (
    <div className={s.root}>
      <div className={s.items}>
        <Feature name="RISK_LEVELS">
          <Form.Layout.Label
            orientation="horizontal"
            title={'CRA risk level'}
            tooltip={`Manually adjusting CRA risk level will override the ${settings.userAlias}s risk level for all future rule checks.`}
          >
            <>
              <UserManualRiskPanel userId={userId} />
            </>
          </Form.Layout.Label>
        </Feature>
        <div className={s['row-items']}>
          <KycStatusEditor onNewComment={onNewComment} title={'KYC status'} userRes={userRes} />
          <UserStateEditor
            onNewComment={onNewComment}
            title={`${firstLetterUpper(settings.userAlias)} status`}
            userRes={userRes}
          />
        </div>
      </div>
      <Feature name={['RISK_SCORING', 'RISK_LEVELS']} fallback={''}>
        <div className={s.risks}>
          <KycRiskDisplay userId={userId} />
          <UserTrsRiskDisplay userId={userId} />
          <DynamicRiskDisplay userId={userId} />
        </div>
      </Feature>
    </div>
  );
}
