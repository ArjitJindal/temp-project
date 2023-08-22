import { Card } from 'antd';
import Button from '../Button';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';
import { H4, P } from '@/components/ui/Typography';

interface Props {
  title?: string;
  description?: string;
  action?: string;
  onActionButtonClick?: () => void;
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
