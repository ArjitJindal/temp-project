import s from './style.module.less';

interface Props {
  title: string;
  description: string;
}

export default function StepHeader(props: Props) {
  const { title, description } = props;
  return (
    <div className={s.root}>
      <div className={s.title}>{title}</div>
      <div className={s.description}>{description}</div>
    </div>
  );
}
