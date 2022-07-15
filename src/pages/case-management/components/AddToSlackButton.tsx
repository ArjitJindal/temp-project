import { Tooltip } from 'antd';
import { useAuth0User } from '@/utils/user-utils';

export const AddToSlackButton: React.FC = () => {
  const user = useAuth0User();
  const redirectUri = `${user.tenantConsoleApiUrl}/slack/oauth_redirect`;
  const href = `https://slack.com/oauth/v2/authorize?scope=incoming-webhook&redirect_uri=${redirectUri}&client_id=${SLACK_CLIENT_ID}&state=${user.tenantId}`;
  return (
    <Tooltip title="Receive the real-time notification in a Slack channel whenever there's a new case created">
      <a href={href} target="__blank">
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
