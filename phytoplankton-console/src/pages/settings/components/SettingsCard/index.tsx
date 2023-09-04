import { Card } from 'antd';
import s from './style.module.less';
import { H4, P } from '@/components/ui/Typography';

interface Props {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export default function SettingsCard(props: Props) {
  const { title, description, children } = props;
  return (
    <div>
      <Card style={{ borderRadius: '8px', marginBottom: '10px' }} bodyStyle={{ padding: '18px' }}>
        <H4 className={s.heading}>{title}</H4>
        <P className={s.paragraph}>{description}</P>
        {children}
      </Card>
    </div>
  );
}
