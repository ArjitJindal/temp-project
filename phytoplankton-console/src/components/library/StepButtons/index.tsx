import Button, { ButtonProps } from '../Button';
import s from './style.module.less';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';

interface Props {
  onNext: () => void;
  onPrevious: () => void;
  actionProps?: {
    actionText: string;
    actionDisabled?: boolean;
    onAction: () => void;
    buttonExtraProps?: Partial<ButtonProps>;
  };
  nextDisabled?: boolean;
  prevDisabled?: boolean;
  hidePrev?: boolean;
  extraInfo?: { label: string; redirectUrl: string };
}

export default function StepButtons(props: Props) {
  const { nextDisabled, prevDisabled, actionProps, hidePrev, onNext, onPrevious } = props;
  return (
    <div className={s.root}>
      {!hidePrev && (
        <Button
          testName="previous-button"
          key="previous"
          type="SECONDARY"
          isDisabled={prevDisabled}
          onClick={onPrevious}
          icon={<ArrowLeftSLineIcon />}
        >
          Previous
        </Button>
      )}
      {nextDisabled && actionProps ? (
        <Button
          testName="action-button"
          key="submit"
          type="PRIMARY"
          onClick={actionProps.onAction}
          isDisabled={actionProps.actionDisabled}
          {...actionProps.buttonExtraProps}
        >
          {actionProps.actionText}
        </Button>
      ) : (
        <Button
          testName="next-button"
          key="next"
          type="SECONDARY"
          isDisabled={nextDisabled}
          onClick={onNext}
          iconRight={<ArrowRightSLineIcon />}
        >
          Next
        </Button>
      )}
      {props.extraInfo && (
        <Button
          key="next"
          type="SECONDARY"
          onClick={() => window.open(props.extraInfo?.redirectUrl, '_blank')}
        >
          {props.extraInfo.label}
        </Button>
      )}
    </div>
  );
}
