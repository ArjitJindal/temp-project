import { Card } from 'antd';
import Button from '../Button';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';
import { H4, P } from '@/components/ui/Typography';
import EmptyBoxIcon from '@/components/ui/icons/empty-illustration.react.svg';

interface Props {
  title?: string;
  description?: string;
  action?: string;
  onActionButtonClick?: () => void;
  showIcon?: boolean;
}

export function EmptyEntitiesInfo(props: Props) {
  const { title, description, action, onActionButtonClick } = props;
  return (
    <Card
      bordered={false}
      bodyStyle={{
        height: 500,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ marginBottom: 16 }}>{props.showIcon && <EmptyBoxIcon />}</div>
      <H4 style={{ fontSize: 18 }}> {title ?? 'No data'}</H4>
      {description && (
        <P variant={'sml'} grey={true}>
          {description}
        </P>
      )}
      {action && (
        <Button
          type="PRIMARY"
          size="MEDIUM"
          onClick={() => onActionButtonClick && onActionButtonClick()}
          icon={<AddLineIcon />}
        >
          {action}
        </Button>
      )}
    </Card>
  );
}
