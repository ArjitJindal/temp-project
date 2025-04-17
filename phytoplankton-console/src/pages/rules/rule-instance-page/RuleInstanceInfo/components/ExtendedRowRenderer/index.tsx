import React from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import { OverviewCard } from '@/pages/dashboard/analysis/components/widgets/OverviewCard';
import TimeLineIcon from '@/components/ui/icons/Remix/system/time-line.react.svg';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import TransactionsIcon from '@/components/AppWrapper/Menu/icons/transactions.react.svg';
import ArrowDownLineIcon from '@/components/ui/icons/Remix/system/arrow-down-line.react.svg';
import DownwardZigZagIcon from '@/components/ui/icons/downward-line-zig-zag.react.svg';
import { VarThresholdData } from '@/apis';
import { DurationDisplay } from '@/components/ui/DurationDisplay';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
interface Props {
  data: VarThresholdData;
}

export default function ExtendedRowRenderer(props: Props) {
  const { falsePositivesReduced, timeReduced, transactionsHit, usersHit } = props.data;
  const settings = useSettings();

  return (
    <div className={s.metricGrid}>
      <OverviewCard
        sections={[
          {
            title: <div className={s.title}>False positives reduced by</div>,
            valueComponent: (
              <div className={s.valueRoot}>
                <div className={s.percentageContainer}>
                  {falsePositivesReduced}% <ArrowDownLineIcon className={s.downArrow} />
                </div>
                <DownwardZigZagIcon className={s.zigZag} />
              </div>
            ),
            type: 'DISPLAY',
          },
        ]}
        highlighted={true}
      />
      <OverviewCard
        sections={[
          {
            title: (
              <div className={s.title}>
                <TimeLineIcon className={s.titleIcon} />
                <>Total work hours saved since rule enabled</>
              </div>
            ),
            valueComponent: (
              <div className={s.valueRoot}>
                <DurationDisplay milliseconds={timeReduced} granularitiesCount={2} />
              </div>
            ),
            type: 'DISPLAY',
          },
        ]}
      />
      <OverviewCard
        sections={[
          {
            title: (
              <div className={s.title}>
                <TransactionsIcon className={s.titleIcon} />
                <>Transactions hit </>
              </div>
            ),
            valueComponent: <div className={s.valueRoot}>{transactionsHit}</div>,
            type: 'DISPLAY',
          },
        ]}
      />
      <OverviewCard
        sections={[
          {
            title: (
              <div className={s.title}>
                <User3LineIcon className={s.titleIcon} />
                <>{`${firstLetterUpper(settings.userAlias)}s hit`}</>
              </div>
            ),
            type: 'DISPLAY',
            valueComponent: <div className={s.valueRoot}>{usersHit}</div>,
          },
        ]}
      />
    </div>
  );
}
