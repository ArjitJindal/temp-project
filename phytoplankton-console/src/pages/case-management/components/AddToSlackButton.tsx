import { Tooltip } from 'antd';
import { useAuth0User, useHasPermissions } from '@/utils/user-utils';

export const AddToSlackButton: React.FC = () => {
  const user = useAuth0User();
  const permissions = useHasPermissions(['settings:notifications:write']);
  const redirectUri = `${user.tenantConsoleApiUrl}/slack/oauth_redirect`;
  const href = `https://slack.com/oauth/v2/authorize?scope=incoming-webhook&redirect_uri=${redirectUri}&client_id=${SLACK_CLIENT_ID}&state=${user.tenantId}`;
  return (
    <Tooltip title="Receive real-time notifications in Slack whenever a new case is created">
      <a href={href} target="__blank" aria-disabled={!permissions}>
        <img
          alt="Add to Slack"
          height="40"
          width="139"
          src="https://platform.slack-edge.com/img/add_to_slack.png"
          srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
        />
      </a>
    </Tooltip>
  );
};
