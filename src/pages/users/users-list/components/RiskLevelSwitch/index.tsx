import { Radio } from 'antd';
import s from './styles.module.less';
import { RISK_LEVEL_COLORS, RISK_LEVELS, RiskLevel } from '@/utils/risk-levels';
import { neverReturn } from '@/utils/lang';

function getLabel(risk: RiskLevel) {
  switch (risk) {
    case 'VERY_LOW':
      return 'Very low';
    case 'LOW':
      return 'Low';
    case 'MEDIUM':
      return 'Medium';
    case 'HIGH':
      return 'High';
    case 'VERY_HIGH':
      return 'Very high';
  }
  return neverReturn(risk, 'Low');
}

interface Props {
  disabled: boolean;
  current: RiskLevel | null;
  onChange: (newValue: RiskLevel) => void;
}

export default function RiskSwitch(props: Props): JSX.Element {
  const { disabled, current, onChange } = props;
  return (
    <Radio.Group
      disabled={disabled}
      value={current}
      onChange={(e) => {
        onChange(e.target.value as RiskLevel);
      }}
      defaultValue={current}
      buttonStyle={'solid'}
      size="small"
    >
      {RISK_LEVELS.map((level) => {
        const isCurrent = level === current;
        return (
          <Radio.Button
            key={level}
            value={level}
            className={s.button}
            style={
              isCurrent
                ? {
                    borderWidth: 1,
                    background: RISK_LEVEL_COLORS[level].light,
                    color: RISK_LEVEL_COLORS[level].primary,
                    borderColor: RISK_LEVEL_COLORS[level].primary,
                  }
                : {}
            }
          >
            {getLabel(level)}
          </Radio.Button>
        );
      })}
    </Radio.Group>
  );
}
