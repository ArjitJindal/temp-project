import { Tag } from 'antd';
import style from './index.module.less';
import Warning from '@/components/ui/icons/Remix/system/error-warning-line.react.svg';
import {
  COLORS_V2_HIGHLIGHT_FLAGRIGHTBLUE,
  COLORS_V2_HIGHLIGHT_HIGHLIGHT_STROKE,
  COLORS_V2_RISK_LEVEL_BASE_VERY_HIGH,
  COLORS_V2_RISK_LEVEL_BG_VERY_HIGH,
} from '@/components/ui/colors';
import Tooltip from '@/components/library/Tooltip';

interface Props {
  percentage: number;
  runs?: number;
}

export const RuleHitInsightsTag: React.FC<Props> = ({ percentage, runs }) => {
  if (runs && percentage > 0 && percentage < 10) {
    return <></>;
  }
  const tooManyHits = percentage > 10;
  const noRuns = !runs;
  return (
    <Tooltip
      title={
        tooManyHits
          ? 'This rule has too many hits. This potentially could lead to a large volume of false positives. Perhaps it is time to re-configure'
          : noRuns
          ? 'This run has not run for any transactions or users. Perhaps you should have another look at the configuration.'
          : 'This rule has had no hits. You could re-check the configuration to make sure you are targeting the right attributes.'
      }
    >
      <span className={style.tag}>
        <Tag
          color={
            tooManyHits ? COLORS_V2_RISK_LEVEL_BG_VERY_HIGH : COLORS_V2_HIGHLIGHT_FLAGRIGHTBLUE
          }
          style={{
            border: `1px solid ${
              tooManyHits
                ? COLORS_V2_RISK_LEVEL_BASE_VERY_HIGH
                : COLORS_V2_HIGHLIGHT_HIGHLIGHT_STROKE
            }`,
            margin: 0,
          }}
          icon={
            <span className={style.icon}>
              <Warning />
            </span>
          }
        >
          {tooManyHits ? 'High hit rate' : noRuns ? 'Run not run' : 'No hits'}
        </Tag>
      </span>
    </Tooltip>
  );
};
