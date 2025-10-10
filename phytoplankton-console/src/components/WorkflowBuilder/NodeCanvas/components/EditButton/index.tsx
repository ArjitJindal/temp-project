import cn from 'clsx';
import s from './index.module.less';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';

interface Props {
  onClick?: () => void;
}

export default function EditButton(props: Props) {
  const { onClick } = props;
  return (
    <button className={cn(s.root, 'nodrag')} onClick={onClick}>
      <EditLineIcon />
    </button>
  );
}
