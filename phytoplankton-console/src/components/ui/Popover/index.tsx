import { Popover as PopoverAntd } from 'antd';

interface Props {
  color?: string;
  content: React.ReactNode;
  title?: string;
  trigger?: 'click' | 'hover' | 'focus';
  children: React.ReactNode;
  wrapText?: boolean;
}

export const Popover = (props: Props): JSX.Element => {
  const { color, content, title, trigger = 'hover', children } = props;
  return (
    <PopoverAntd content={content} title={title} color={color} trigger={trigger}>
      <div>{children}</div>
    </PopoverAntd>
  );
};

export default Popover;
