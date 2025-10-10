import s from './index.module.less';
import Tag from '@/components/library/Tag';

interface Props {
  children: string | undefined;
}

const ClosingReasonTag: React.FC<Props> = ({ children }) => {
  if (!children) {
    return <></>;
  }
  return <Tag className={s.root}>{children}</Tag>;
};

export default ClosingReasonTag;
