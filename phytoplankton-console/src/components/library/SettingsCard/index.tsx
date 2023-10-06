import s from './style.module.less';
import * as Card from '@/components/ui/Card';
import { H4, P } from '@/components/ui/Typography';

interface Props {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export default function SettingsCard(props: Props) {
  const { title, description, children } = props;
  return (
    <Card.Root noBorder className={s.root}>
      <H4 className={s.heading}>{title}</H4>
      {description && <P className={s.paragraph}>{description}</P>}
      {children}
    </Card.Root>
  );
}
