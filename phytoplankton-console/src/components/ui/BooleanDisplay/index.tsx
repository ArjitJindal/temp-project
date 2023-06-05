import style from './index.module.less';
import CheckMark from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import CloseCircle from '@/components/ui/icons/Remix/system/close-circle-fill.react.svg';

interface Props {
  value?: boolean;
}

export const BooleanDisplay: React.FC<Props> = ({ value }) => {
  if (value === null) {
    return <>-</>;
  }
  return (
    <span>
      <span className={style.tag}>
        <span className={value ? style.iconTrue : style.iconFalse}>
          {value ? <CheckMark /> : <CloseCircle />}
        </span>
        {value ? 'Yes' : 'No'}
      </span>
    </span>
  );
};
