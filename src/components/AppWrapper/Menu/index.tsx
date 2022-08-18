import { Menu as AntMenu } from 'antd';
import {
  BarChartOutlined,
  DashboardOutlined,
  FlagOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SmileOutlined,
  TableOutlined,
  UsergroupAddOutlined,
  SettingOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import {
  browserName,
  deviceType,
  browserVersion,
  osName,
  mobileModel,
  mobileVendor,
} from 'react-device-detect';
import { Link } from 'react-router-dom';
import { ItemType } from 'antd/es/menu/hooks/useItems';
import { matchPath, useLocation } from 'react-router';
import s from './styles.module.less';
import { useAuth0User } from '@/utils/user-utils';
import { useAnalytics } from '@/utils/segment/context';
import { I18n, TranslationId, useI18n } from '@/locales';
import { useRoutes } from '@/services/routing';
import { hasName, isTree, RouteItem } from '@/services/routing/types';

const icons = {
  FlagOutlined: <FlagOutlined />,
  UsergroupAddOutlined: <UsergroupAddOutlined />,
  UnorderedListOutlined: <UnorderedListOutlined />,
  TeamOutlined: <TeamOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  SettingOutlined: <SettingOutlined />,
  dashboard: <DashboardOutlined />,
  smile: <SmileOutlined />,
  table: <TableOutlined />,
  ImportOutlined: <ImportOutlined />,
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
            label: (
              <Link to={item.path} className={s.links}>
                <span className={s.menuItem}>{i18n(fullKey as TranslationId)}</span>
              </Link>
            ),
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
  const analytics = useAnalytics();
  const user = useAuth0User();

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
        items={renderItems(
          'menu',
          routes.filter((route) => route.position === 'bottom'),
          i18n,
        ).concat([
          {
            key: 'button',
            onClick: () => {
              analytics.event({
                title: 'Clicked on sidebar Collapse button',
                tenant: user.tenantName,
                userId: user.userId,
                browserName,
                deviceType,
                browserVersion,
                osName,
                mobileModel,
                mobileVendor,
              });
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
