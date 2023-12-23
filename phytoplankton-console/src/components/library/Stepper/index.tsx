import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';
import MoreLineIcon from '@/components/ui/icons/Remix/system/more-line.react.svg';

export type Step = {
  key: string;
  title: string;
  description: string;
  isOptional?: boolean;
  isUnfilled?: boolean;
  isInvalid?: boolean;
};
interface Props {
  steps: Step[];
  active: string;
  className?: string;
  layout?: 'HORIZONTAL' | 'VERTICAL';
  onChange: (key: string) => void;
  children?: (active: string) => React.ReactNode;
}

export default function Stepper(props: Props) {
  const { layout = 'HORIZONTAL', active, steps, className, onChange, children } = props;
  const number = steps.findIndex(({ key }) => key === active);

  const handleStepClick = (stepKey: string) => {
    onChange(stepKey);
  };

  return (
    <div className={cn(s.root, className, s[`layout-${layout}`])}>
      <div className={s.steps}>
        {steps.map((step, i) => {
          const isPassed = i < number;
          const isActive = active === step.key;
          const { isUnfilled, isInvalid } = step;
          return (
            <div
              key={step.key}
              className={cn(s.step, {
                [s.isPassed]: isPassed,
                [s.isActive]: isActive,
                [s.inUnfilled]: isUnfilled,
                [s.isInvalid]: isInvalid,
              })}
              onClick={() => handleStepClick(step.key)}
            >
              <div className={s.stepNumber}>
                {isPassed && (isUnfilled || isInvalid ? <MoreLineIcon /> : <CheckLineIcon />)}
                {!isPassed && i + 1}
              </div>
              <div>
                <div className={s.stepTitle}>
                  {step.title}
                  {step.isOptional && <span className={s.optional}>{' - optional'}</span>}
                </div>
                <div className={s.stepDescription}>{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>
      {children && <div className={s.children}>{children(active)}</div>}
    </div>
  );
}
