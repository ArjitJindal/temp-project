import Tooltip from '@/components/library/Tooltip';
import { useAuth0User, useHasResources } from '@/utils/user-utils';

export const AddToSlackButton: React.FC = () => {
  const user = useAuth0User();
  const permissions = useHasResources(['write:::settings/notifications/slack-notifications/*']);
  const redirectUri = `${user.tenantConsoleApiUrl}/slack/oauth_redirect`;
  const href = `https://slack.com/oauth/v2/authorize?scope=incoming-webhook&redirect_uri=${redirectUri}&client_id=${SLACK_CLIENT_ID}&state=${user.tenantId}`;
  return (
    <a href={href} target="__blank" aria-disabled={!permissions}>
      <Tooltip title="Receive real-time notifications in Slack whenever a new case is created">
        {(targetProps) => (
          <img
            {...targetProps}
            alt="Add to Slack"
            height="40"
            width="139"
            src="https://platform.slack-edge.com/img/add_to_slack.png"
            srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
          />
        )}
      </Tooltip>
    </a>
  );
};
