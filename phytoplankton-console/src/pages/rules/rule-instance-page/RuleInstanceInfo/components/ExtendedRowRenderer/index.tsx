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
import Tooltip from '@/components/library/Tooltip';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';

interface Props {
  data: VarThresholdData;
}

export default function ExtendedRowRenderer(props: Props) {
  const { falsePositivesReduced, timeReduced, transactionsHit, usersHit, createdAt } = props.data;
  const settings = useSettings();

  const formatDate = (timestamp?: number): string => {
    return dayjs(timestamp).format(DEFAULT_DATE_TIME_FORMAT);
  };

  const tooltipExplanation = `Total amount of time saved if the rule had been activated with the recommended threshold from ${formatDate(
    createdAt,
  )}`;
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
                <>Estimated time saved</>
                <Tooltip title={tooltipExplanation}>
                  <InformationLineIcon className={s.infoIcon} />
                </Tooltip>
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
