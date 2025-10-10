import { formatDuration, getDuration } from '@/utils/time-utils';
import { P } from '@/components/ui/Typography';

type Props = {
  milliseconds?: number;
  granularitiesCount?: number;
};

export const DurationDisplay = (props: Props): JSX.Element => {
  const { milliseconds, granularitiesCount } = props;
  const duration = getDuration(milliseconds ?? 0);
  return props.milliseconds ? (
    <P variant="m">{formatDuration(duration, granularitiesCount)}</P>
  ) : (
    <>-</>
  );
};
