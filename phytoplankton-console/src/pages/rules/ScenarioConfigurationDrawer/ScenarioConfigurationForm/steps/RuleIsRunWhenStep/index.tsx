import s from './style.module.less';

export interface FormValues {}

export const INITIAL_VALUES: FormValues = {};

interface Props {}

export default function RuleIsRunWhenStep(_props: Props) {
  return <div className={s.root}>RuleIsRunWhenStep</div>;
}
