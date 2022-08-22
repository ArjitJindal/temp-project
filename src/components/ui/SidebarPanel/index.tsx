import Card from 'antd/es/card';
import Layout from 'antd/es/layout';
import { Content } from 'antd/es/layout/layout';
import Sider from 'antd/es/layout/Sider';
import Menu from 'antd/es/menu';
import { useCallback, useMemo, useState } from 'react';
import styles from './SidebarPanel.module.less';

type MenuItem = {
  name: string;
  content: React.ReactNode;
};

export type MenuSection = {
  name: string;
  menuItems: MenuItem[];
};

interface Props {
  menuSections: MenuSection[];
}

function getMenuItemKey(sectionName: string, menuItemName: string) {
  return `${sectionName}-${menuItemName}`;
}

export default function SidebarPanel({ menuSections }: Props): JSX.Element {
  const defaultSelectedKey = getMenuItemKey(
    menuSections[0]?.name,
    menuSections[0]?.menuItems?.[0]?.name,
  );
  const [activeMenuItem, setActiveMenuItem] = useState(defaultSelectedKey);
  const handleMenuItemClick = useCallback(({ key }) => {
    setActiveMenuItem(key);
  }, []);
  const menuItems = useMemo(() => {
    return menuSections.flatMap((section) =>
      [
        <Menu.Item disabled key={section.name}>
          {section.name}
        </Menu.Item>,
      ].concat(
        section.menuItems.map((menuItem) => (
          <Menu.Item key={getMenuItemKey(section.name, menuItem.name)}>{menuItem.name}</Menu.Item>
        )),
      ),
    );
  }, [menuSections]);
  const contentByMenuItemKey = useMemo(
    () =>
      new Map(
        menuSections.flatMap((section) =>
          section.menuItems.map((menuItem) => [
            getMenuItemKey(section.name, menuItem.name),
            menuItem.content,
          ]),
        ),
      ),
    [menuSections],
  );
  return (
    <Layout>
      <Sider className={styles.Sidebar} width={200}>
        <Menu
          mode="inline"
          expandIcon={<></>}
          selectedKeys={[activeMenuItem]}
          inlineCollapsed={false}
          style={{ height: '100%' }}
          onSelect={handleMenuItemClick}
        >
          {menuItems}
        </Menu>
      </Sider>

      <Content style={{ minHeight: 280 }}>
        <Card bordered={false}>{contentByMenuItemKey.get(activeMenuItem)}</Card>
      </Content>
    </Layout>
  );
}
