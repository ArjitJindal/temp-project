import s from './index.module.less';

interface Props {
  name: string | undefined;
}

export default function Avatar(props: Props) {
  const { name } = props;
  return <div className={s.root}>{name ? name.charAt(0) : '?'}</div>;
}
