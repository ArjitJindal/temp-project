import { Typography } from 'antd';
import { formatDuration, getDuration } from '@/utils/time-utils';

type Props = {
  milliseconds?: number;
  granularitiesCount?: number;
};

export const DurationDisplay = (props: Props): JSX.Element => {
  const { milliseconds, granularitiesCount } = props;
  const duration = getDuration(milliseconds ?? 0);
  return props.milliseconds ? (
    <Typography.Text>{formatDuration(duration, granularitiesCount)}</Typography.Text>
  ) : (
    <>-</>
  );
};
