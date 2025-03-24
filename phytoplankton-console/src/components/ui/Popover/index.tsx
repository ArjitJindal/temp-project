import { Popover as PopoverAntd, PopoverProps } from 'antd';

interface Props extends PopoverProps {
  color?: string;
  content: React.ReactNode;
  title?: string;
  trigger?: 'click' | 'hover' | 'focus';
  children: React.ReactNode;
  wrapText?: boolean;
}

export const Popover = (props: Props): JSX.Element => {
  const { color, content, title, trigger = 'hover', children, ...rest } = props;
  return (
    <PopoverAntd content={content} title={title} color={color} trigger={trigger} {...rest}>
      <div>{children}</div>
    </PopoverAntd>
  );
};

export default Popover;
