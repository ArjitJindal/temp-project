import { UI_SETTINGS } from '../ui-settings';
import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import DeviceDataCard from './DeviceDataCard';
import s from './index.module.less';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { Small } from '@/components/ui/Typography';
import CommentsCard from '@/components/CommentsCard';
import Authorized from '@/components/Authorized';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { DEVICE_DATA_USER } from '@/utils/queries/keys';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import AIInsightsCard from '@/pages/case-management-item/CaseDetails/AIInsightsCard';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser;
  isEmbedded?: boolean;
  updateCollapseState?: (key: string, value: boolean) => void;
  onUserUpdate?: (userItem: InternalBusinessUser | InternalConsumerUser) => void;
  onReload: () => void;
  showCommentEditor?: boolean;
  hideExpectedTransactionLimits?: boolean;
  hideAIInsights?: boolean;
  uiSettings: typeof UI_SETTINGS;
}

function UserDetails(props: Props) {
  const {
    user,
    showCommentEditor = true,
    onUserUpdate,
    uiSettings,
    hideExpectedTransactionLimits,
    hideAIInsights,
  } = props;

  const api = useApi();
  const isMLDemoEnabled = useFeatureEnabled('MACHINE_LEARNING_DEMO');

  const deviceDataRes = useQuery(DEVICE_DATA_USER(user?.userId), async () => {
    if (user?.userId) {
      return await api.getDeviceDataUsers({
        userId: user.userId,
      });
    }
    return null;
  });

  if (user == null || !('type' in user)) {
    return <Small>No user details found</Small>;
  }
  return (
    <div className={s.root}>
      <Authorized required={['users:user-details:read']}>
        <>
          {user?.type === 'BUSINESS' && (
            <BusinessUserDetails
              user={user}
              updateCollapseState={props.updateCollapseState}
              uiSettings={uiSettings}
              hideExpectedTransactionLimits={hideExpectedTransactionLimits}
            />
          )}
          {user?.type === 'CONSUMER' && (
            <ConsumerUserDetails
              user={user}
              updateCollapseState={props.updateCollapseState}
              uiSettings={uiSettings}
            />
          )}
          <AsyncResourceRenderer resource={deviceDataRes.data}>
            {(deviceData) =>
              deviceData ? (
                <DeviceDataCard
                  updateCollapseState={props.updateCollapseState}
                  title={uiSettings.cards.DEVICE_DATA.title}
                  collapsableKey={uiSettings.cards.DEVICE_DATA.key}
                  deviceData={deviceData}
                />
              ) : null
            }
          </AsyncResourceRenderer>
        </>
      </Authorized>
      {isMLDemoEnabled && user?.type === 'BUSINESS' && !hideAIInsights && (
        <AIInsightsCard
          user={user}
          updateCollapseState={props.updateCollapseState}
          title={UI_SETTINGS.cards.AI_INSIGHTS.title}
          collapsableKey={UI_SETTINGS.cards.AI_INSIGHTS.key}
        />
      )}
      {showCommentEditor && (
        <CommentsCard
          id={user.userId}
          comments={user.comments ?? []}
          onCommentsUpdate={(newComments) => {
            onUserUpdate && onUserUpdate({ ...user, comments: newComments });
          }}
          updateCollapseState={props.updateCollapseState}
          commentType={'USER'}
          title={UI_SETTINGS.cards.COMMENTS.title}
          collapsableKey={UI_SETTINGS.cards.COMMENTS.key}
        />
      )}
    </div>
  );
}

export default UserDetails;
