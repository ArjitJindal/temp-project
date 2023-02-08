import { Menu as AntMenu, Popover } from 'antd';
import {
  BarChartOutlined,
  FlagOutlined,
  ImportOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  SmileOutlined,
  UnorderedListOutlined,
  UsergroupAddOutlined,
  GlobalOutlined,
  ContainerOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { ItemType } from 'antd/es/menu/hooks/useItems';
import { matchPath, useLocation } from 'react-router';
import { useContext, useEffect } from 'react';
import { SideBarContext } from '../Providers/SidebarProvider';
import TeamOutlined from './Team_Outlined.react.svg';
import Dashboard from './Dashboard.react.svg';
import Table from './Table.react.svg';
import GavelIcon from './gavel.react.svg';
import s from './styles.module.less';
import { I18n, TranslationId, useI18n } from '@/locales';
import { useRoutes } from '@/services/routing';
import { hasName, isTree, RouteItem } from '@/services/routing/types';
import { getBranding } from '@/utils/branding';

const icons = {
  FlagOutlined: (
    <span>
      <FlagOutlined />
    </span>
  ),
  UsergroupAddOutlined: <UsergroupAddOutlined />,
  UnorderedListOutlined: <UnorderedListOutlined />,
  Gavel: <GavelIcon />,
  TeamOutlined: <TeamOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  SettingOutlined: <SettingOutlined />,
  dashboard: <Dashboard />,
  smile: <SmileOutlined />,
  table: <Table />,
  ImportOutlined: <ImportOutlined />,
  GlobalOutlined: <GlobalOutlined />,
  ContainerOutlined: <ContainerOutlined />,
};

function getSelectedKeys(routes: RouteItem[], currentPath: string): string[] {
  const result = [];
  for (const route of routes) {
    if (hasName(route)) {
      if (
        matchPath(
          {
            path: route.path,
            end: false,
          },
          currentPath,
        )
      ) {
        result.push(route.name);
      }
      if (isTree(route)) {
        result.push(...getSelectedKeys(route.routes, currentPath));
      }
    }
  }
  return result;
}

const branding = getBranding();
const disabledMessage = (
  <div>
    Please <a href={`mailto:${branding.supportEmail}`}>contact us</a> to access this feature.
  </div>
);
function renderItems(parentTranslationKey: string, items: RouteItem[], i18n: I18n): ItemType[] {
  return items
    .filter((route) => ('redirect' in route ? false : !route.hideInMenu))
    .map((item) => {
      if ('redirect' in item) {
        return null;
      }
      const fullKey = `${parentTranslationKey}.${item.name}`;
      const icon = item.icon ? icons[item.icon] : undefined;

      return 'routes' in item && !item.hideChildrenInMenu
        ? {
            key: item.name,
            label: <span className={s.menuItem}>{i18n(fullKey as TranslationId)}</span>,
            title: i18n(fullKey as TranslationId),
            icon: icon,
            children: renderItems(fullKey, item.routes, i18n),
          }
        : {
            key: item.name,
            icon: icon,
            label: item.disabled ? (
              <Popover content={disabledMessage}>
                <span className={s.menuItem}>{i18n(fullKey as TranslationId)}</span>
              </Popover>
            ) : (
              <Link to={item.path} className={s.links}>
                <span className={s.menuItem}>{i18n(fullKey as TranslationId)}</span>
              </Link>
            ),
            disabled: item.disabled,
            title: i18n(fullKey as TranslationId),
          };
    });
}

export default function Menu(props: {
  isCollapsed: boolean;
  onChangeCollapsed: (value: boolean) => void;
}) {
  const { isCollapsed, onChangeCollapsed } = props;

  const i18n = useI18n();
  const routes = useRoutes();
  const location = useLocation();

  const sideBarCollapseContext = useContext(SideBarContext);

  useEffect(() => {
    if (sideBarCollapseContext.collapseSideBar === 'AUTOMATIC') {
      onChangeCollapsed(true);
    }
  }, [sideBarCollapseContext.collapseSideBar, onChangeCollapsed]);

  const selectedKeys = getSelectedKeys(routes, location.pathname);
  return (
    <div className={s.root}>
      <div className={s.menuWrapper}>
        <AntMenu
          inlineCollapsed={isCollapsed}
          className={s.menu}
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={selectedKeys}
          items={renderItems(
            'menu',
            routes.filter((route) => route.position === 'top'),
            i18n,
          )}
        />
      </div>
      <AntMenu
        inlineCollapsed={isCollapsed}
        theme="dark"
        mode="inline"
        selectedKeys={selectedKeys}
        items={renderItems(
          'menu',
          routes.filter((route) => route.position === 'bottom'),
          i18n,
        ).concat([
          {
            key: 'button',
            onClick: () => {
              sideBarCollapseContext.setCollapseSideBar('MANUAL');
              return onChangeCollapsed(!isCollapsed);
            },
            icon: isCollapsed ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />,
            style: !isCollapsed ? { background: 'transparent' } : { background: 'transparent' },
          },
        ])}
      />
    </div>
  );
}
