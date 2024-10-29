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
  showButtonIcon?: boolean;
  actionPadding?: string;
}

export function EmptyEntitiesInfo(props: Props) {
  const { title, description, action, onActionButtonClick, showButtonIcon = true } = props;
  return (
    <Card
      bordered={false}
      bodyStyle={{
        height: 287,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ marginBottom: 16 }}>{props.showIcon && <EmptyBoxIcon />}</div>
      <H4 style={{ fontSize: 18 }}> {title ?? 'No data'}</H4>
      {description && (
        <P variant="m" fontWeight="normal" grey={true} style={{ marginBottom: '8px' }}>
          {description}
        </P>
      )}
      {action && (
        <Button
          type="PRIMARY"
          size="MEDIUM"
          onClick={() => onActionButtonClick && onActionButtonClick()}
          icon={showButtonIcon ? <AddLineIcon /> : undefined}
        >
          {action}
        </Button>
      )}
    </Card>
  );
}
