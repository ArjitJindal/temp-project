import { Radio } from 'antd';
import cn from 'clsx';
import s from './styles.module.less';
import { RISK_LEVEL_COLORS, RISK_LEVELS, RiskLevel } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  disabled?: boolean;
  current: RiskLevel | null;
  onChange: (newValue: RiskLevel) => void;
}

export default function RiskSwitch(props: Props): JSX.Element {
  const { disabled, current, onChange } = props;
  const settings = useSettings();
  return (
    <Radio.Group
      className={cn(s.root)}
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
              isCurrent && !disabled
                ? {
                    borderWidth: 1,
                    background: RISK_LEVEL_COLORS[level].light,
                    color: RISK_LEVEL_COLORS[level].text,
                    borderColor: RISK_LEVEL_COLORS[level].primary,
                  }
                : {}
            }
          >
            {getRiskLevelLabel(level, settings)}
          </Radio.Button>
        );
      })}
    </Radio.Group>
  );
}
