import React, { useMemo } from 'react';
import cn from 'clsx';
import { ValueItem } from '../types';
import s from './index.module.less';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import { RISK_LEVEL_COLORS, RiskLevel, useRiskLevel } from '@/utils/risk-levels';
import RiskLevelTag from '@/components/library/Tag/RiskLevelTag';
import { useId } from '@/utils/hooks';
import Tooltip from '@/components/library/Tooltip';

export type MainPanelCustomStyles = Partial<{
  background?: string;
}>;

interface Props {
  icon: React.ReactNode;
  title: string;
  lastItem?: ValueItem;
  onClickInfo?: () => void;
  customStyling?: MainPanelCustomStyles;
  riskScoreAlgo: (value: ValueItem) => number;
  sortedItems: ValueItem[];
  defaultText?: string;
}

export default function MainPanel(props: Props) {
  const { title, lastItem, icon, customStyling, onClickInfo, riskScoreAlgo, sortedItems } = props;
  const sortedScores = useMemo(() => sortedItems.map(({ score }) => score), [sortedItems]);
  const currentScore: number | undefined = lastItem && riskScoreAlgo(lastItem);
  const derivedRiskLevel = useRiskLevel(currentScore);
  const manualRiskLevel = lastItem?.manualRiskLevel;
  const currentRiskLevel = manualRiskLevel ?? derivedRiskLevel ?? undefined;
  return (
    <div className={cn(s.root)} style={{ background: customStyling?.background }}>
      <div className={s.header}>
        <div className={s.title}>
          <div className={s.icon}>{icon}</div>
          {title}
        </div>
        {onClickInfo && (
          <InformationLineIcon
            className={s.infoIcon}
            onClick={() => {
              onClickInfo?.();
            }}
          />
        )}
        {!onClickInfo && props.defaultText && (
          <Tooltip title={props.defaultText}>
            <div>
              <InformationLineIcon className={s.infoIcon} />
            </div>
          </Tooltip>
        )}
      </div>
      <div className={s.currentValue}>
        <span>{(currentScore ?? 0.0)?.toFixed(2) ?? 'N/A'}</span>
      </div>
      <div>{currentRiskLevel && <RiskLevelTag level={currentRiskLevel} />}</div>
      {sortedScores.length > 1 && <Chart riskLevel={currentRiskLevel} values={sortedScores} />}
    </div>
  );
}

const CHART_WIDTH = 65;
const CHART_HEIGHT = 40;
const CIRCLE_AREA_SIZE = 10;
const CIRCLE_SIZE = 3;
const PADDING = CIRCLE_SIZE / 2;
const CHART_VIEW_WIDTH = CHART_WIDTH - PADDING * 2;
const CHART_VIEW_HEIGHT = CHART_HEIGHT - PADDING * 2;

function Chart(props: { values: number[]; riskLevel?: RiskLevel }) {
  const { riskLevel, values } = props;
  const id = useId(`svg-`);

  const widthPerPoint = CHART_VIEW_WIDTH / (values.length - 1);
  const maxValue = values.reduce((acc, x) => (x > acc ? x : acc), 1);
  const points = [
    ...values.map((value, i) => [widthPerPoint * i, CHART_VIEW_HEIGHT * (1 - value / maxValue)]),
  ];
  const mainColor = riskLevel ? RISK_LEVEL_COLORS[riskLevel].primary : 'gray';
  const lightColor = riskLevel ? RISK_LEVEL_COLORS[riskLevel].light : 'lightgray';
  const gradientId = `${id}-gradient`;

  return (
    <svg
      className={s.chart}
      viewBox={`-${PADDING} -${PADDING} ${CHART_WIDTH} ${CHART_HEIGHT}`}
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={mainColor} />
          <stop offset="60%" stopColor={lightColor} />
          <stop offset="100%" stopColor={lightColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#${gradientId})`}
        points={[...points, [CHART_VIEW_WIDTH, CHART_VIEW_HEIGHT], [0, CHART_VIEW_HEIGHT]]
          .map((x) => x.join(','))
          .join(' ')}
      />
      <polyline
        stroke={mainColor}
        fill="none"
        strokeWidth="1"
        points={points.map((x) => x.join(',')).join(' ')}
      />
      {points.map(([x, y], i) => (
        <svg
          className={s.circleArea}
          key={i}
          x={x - CIRCLE_AREA_SIZE / 2}
          y={y - CIRCLE_AREA_SIZE / 2}
        >
          <rect x="0" y="0" width={CIRCLE_AREA_SIZE} height={CIRCLE_AREA_SIZE} fill="transparent" />
          <circle
            cx={CIRCLE_AREA_SIZE / 2}
            cy={CIRCLE_AREA_SIZE / 2}
            r={CIRCLE_SIZE / 2}
            fill={mainColor}
            stroke="white"
            strokeWidth="0.5"
          />
          <title>{values[i].toFixed(2)}</title>
        </svg>
      ))}
    </svg>
  );
}
