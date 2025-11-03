import cn from 'clsx';
import s from './styles.module.less';
import { RISK_LEVEL_COLORS, RISK_LEVELS, RiskLevel } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useId } from '@/utils/hooks';
import { InputProps } from '@/components/library/Form';

interface Props extends InputProps<RiskLevel> {
  disabledLevels?: RiskLevel[];
}

export default function RiskLevelSwitch(props: Props): JSX.Element {
  const { value, onChange, isDisabled: componentIsDisabled, disabledLevels } = props;
  const settings = useSettings();
  const id = useId('RiskSwitch-');
  const isReadonly = onChange == null;

  return (
    <div className={cn(s.root, componentIsDisabled && s.isDisabled)} data-sentry-allow={true}>
      {RISK_LEVELS.map((level) => {
        const isCurrent = level === value;
        const riskLevelAlias = getRiskLevelLabel(level, settings);
        const isDisabled =
          componentIsDisabled || disabledLevels?.includes(level) || !riskLevelAlias.isActive;

        return (
          <label
            data-cy={`risk-level-${level}`}
            key={level}
            className={cn(
              s.button,
              isReadonly && s.isReadonly,
              isDisabled && s.isDisabled,
              isCurrent && s.isCurrent,
            )}
            style={
              isCurrent
                ? {
                    zIndex: 2,
                    borderWidth: 1,
                    background: isDisabled ? undefined : RISK_LEVEL_COLORS[level].light,
                    color: isDisabled ? undefined : RISK_LEVEL_COLORS[level].text,
                    borderColor: isDisabled ? undefined : RISK_LEVEL_COLORS[level].primary,
                  }
                : isDisabled
                ? { opacity: 0.5 }
                : {}
            }
          >
            {riskLevelAlias.riskLevelLabel}
            <input
              type="radio"
              name={id}
              checked={isCurrent}
              disabled={isDisabled}
              onChange={() => onChange?.(level)}
            />
          </label>
        );
      })}
    </div>
  );
}
