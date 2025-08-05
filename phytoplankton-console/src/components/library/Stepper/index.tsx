import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';
import MoreLineIcon from '@/components/ui/icons/Remix/system/more-line.react.svg';

export type Step = {
  key: string;
  title: string;
  description?: string;
  isOptional?: boolean;
  isUnfilled?: boolean;
  isInvalid?: boolean;
  isDisabled?: boolean;
};
interface Props {
  steps: Step[];
  active: string;
  className?: string;
  stepsClassName?: string;
  layout?: 'HORIZONTAL' | 'VERTICAL';
  onChange: (key: string) => void;
  children?: (active: string) => React.ReactNode;
}

export default function Stepper(props: Props) {
  const { layout = 'HORIZONTAL', active, className, children } = props;

  return (
    <div className={cn(s.root, className, s[`layout-${layout}`])}>
      <div className={s.sticky}>
        <StepperSteps {...props} />
      </div>
      {children && <div className={s.children}>{children(active)}</div>}
    </div>
  );
}

export function StepperSteps(
  props: Pick<Props, 'steps' | 'active' | 'stepsClassName' | 'layout' | 'onChange'>,
) {
  const { active, layout, onChange, steps, stepsClassName } = props;
  const stepIndex = steps.findIndex(({ key }) => key === active);
  return (
    <div className={cn(s.steps, stepsClassName, s[`layout-${layout}`])} data-cy="stepper">
      {steps.map((step, i) => {
        const isPassed = i < stepIndex;
        const isActive = active === step.key;
        const { isUnfilled, isInvalid, isDisabled, isOptional, title, description, key } = step;
        return (
          <div
            key={key}
            className={cn(s.step, {
              [s.isPassed]: isPassed,
              [s.isActive]: isActive,
              [s.inUnfilled]: isUnfilled,
              [s.isInvalid]: isInvalid,
              [s.isDisabled]: isDisabled,
            })}
            onClick={() => {
              if (!isDisabled) {
                onChange(key);
              }
            }}
            data-cy="step-prop"
          >
            <div className={s.stepNumber}>
              {isPassed && (isUnfilled || isInvalid ? <MoreLineIcon /> : <CheckLineIcon />)}
              {!isPassed && i + 1}
            </div>
            <div>
              <div className={s.stepTitle}>
                {title}
                {!isDisabled &&
                  (isOptional ? (
                    <span className={s.optional} data-cy="optional-span">
                      {'\xa0-\xa0optional'}
                    </span>
                  ) : (
                    <span className={s.required}>{'\xa0*'}</span>
                  ))}
              </div>
              {step.description && <div className={s.stepDescription}>{description}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
