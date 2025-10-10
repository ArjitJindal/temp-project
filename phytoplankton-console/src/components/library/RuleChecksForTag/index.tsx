import s from './index.module.less';

interface Props {
  checksFor: string;
}

export default function RuleChecksForTag(props: Props): JSX.Element {
  return (
    <div className={s.root}>
      <div className={s.content}>{props.checksFor}</div>
    </div>
  );
}
