import cn from 'clsx';
import Tag from '../index';
import style from './index.module.less';
import Warning from '@/components/ui/icons/Remix/system/error-warning-line.react.svg';
import Tooltip from '@/components/library/Tooltip';

interface Props {
  percentage: number;
  runs?: number;
  showPercentage?: boolean;
}

const RuleHitInsightsTag: React.FC<Props> = ({ percentage, runs, showPercentage }) => {
  const tooManyHits = percentage > 10;
  const noRuns = !runs;
  return (
    <Tooltip
      title={
        tooManyHits
          ? 'This rule has too many hits. This potentially could lead to a large volume of false positives. Perhaps it is time to re-configure'
          : noRuns
          ? 'This rule has not run for any transactions or users. Perhaps you should have another look at the configuration.'
          : percentage > 0
          ? 'This rule has had moderate hits. You could re-check the configuration to make sure you are targeting the right attributes.'
          : 'This rule has had no hits. You could re-check the configuration to make sure you are targeting the right attributes.'
      }
    >
      <span>
        <Tag
          className={cn(style.root, tooManyHits && style.tooManyHits)}
          icon={<Warning className={style.icon} />}
        >
          {tooManyHits
            ? 'High hit rate'
            : noRuns
            ? 'Rule not run'
            : percentage > 0
            ? 'Moderate hit rate'
            : 'No hits'}
          {showPercentage && ` - ${percentage}%`}
        </Tag>
      </span>
    </Tooltip>
  );
};

export default RuleHitInsightsTag;
