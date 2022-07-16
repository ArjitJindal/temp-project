import { Divider, Typography } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import s from './styles.module.less';

interface Props {
  isCollapsed: boolean;
  title: string;
  children: React.ReactNode;
  onChangeCollapsed: (isCollapsed: boolean) => void;
}

export default function CollapsableSection(props: Props) {
  const { title, isCollapsed, children, onChangeCollapsed } = props;
  return (
    <div className={`${s.root} ${!isCollapsed && s.isOpen}`}>
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onChangeCollapsed(!isCollapsed);
        }}
      >
        <Typography.Title level={5}>
          <span className={s.title}>{title}</span>
          <DownOutlined className={s.icon} />
        </Typography.Title>
      </a>
      {!isCollapsed && children}
    </div>
  );
}
