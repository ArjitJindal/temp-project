import s from './style.module.less';
import Tooltip from '@/components/library/Tooltip';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';

interface Props {
  title: string;
  description: string;
  tooltip?: string;
}

export default function StepHeader(props: Props) {
  const { title, description, tooltip } = props;
  return (
    <div className={s.root}>
      <div className={s.title}>
        {title}
        {tooltip && (
          <span className={s.icon}>
            <Tooltip title={tooltip}>
              <InformationLineIcon />
            </Tooltip>
          </span>
        )}
      </div>
      <div className={s.description}>{description}</div>
    </div>
  );
}
