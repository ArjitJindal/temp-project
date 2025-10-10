import { normalizeCase } from '@flagright/lib/utils/humanize';
import { InputProps } from '@/components/library/Form';
import * as Card from '@/components/ui/Card';
import Button from '@/components/library/Button';
import DeleteBin7LineIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';

interface Props extends InputProps<any> {
  className?: string;
  headerClassName?: string;
  fieldValidation?: boolean;
  children: React.ReactNode;
  title?: string | React.ReactNode;
  arrayItemProps?: {
    itemCount: number;
    handleDeleteItem: () => void;
  };
  testId?: string;
}

export const CollapsePropertiesLayout = (props: Props) => {
  const { children, className, fieldValidation, title, arrayItemProps, testId, headerClassName } =
    props;
  return (
    <Card.Root
      key={arrayItemProps?.itemCount ?? 0}
      className={className}
      isCollapsable={true}
      isCollapsedByDefault={true}
      isInvalid={fieldValidation}
      header={{
        title:
          typeof title === 'string'
            ? normalizeCase(
                `${title ?? 'Item'} ${arrayItemProps ? `#${arrayItemProps.itemCount + 1}` : ''}`,
              )
            : title,
        titleSize: 'SMALL',
        link: arrayItemProps ? (
          <Button
            icon={<DeleteBin7LineIcon />}
            type="DANGER"
            size="SMALL"
            onClick={arrayItemProps.handleDeleteItem}
          />
        ) : null,
      }}
      testId={testId}
      headerClassName={headerClassName}
    >
      <Card.Section>{children}</Card.Section>
    </Card.Root>
  );
};
