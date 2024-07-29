import { ImportOutlined } from '@ant-design/icons';
import React, { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { SideBarContext } from '../Providers/SidebarProvider';
import { useFeaturesEnabled, useFeatureEnabled } from '../Providers/SettingsProvider';
import TeamOutlined from './icons/Team_Outlined.react.svg';
import ListsIcon from './icons/lists.react.svg';
import GavelIcon from './icons/gavel.react.svg';
import AuditLogIcon from './icons/audit-log.react.svg';
import s from './styles.module.less';
import GlobeIcon from './icons/globe.react.svg';
import SettingsIcon from './icons/setting.react.svg';
import AddUsersIcon from './icons/add-users.react.svg';
import TransactionsIcon from './icons/transactions.react.svg';
import Header from './Header';
import Footer from './Footer';
import { Notifications } from './Notifications';
import Article from '@/components/ui/icons/Remix/document/article-line.react.svg';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import BarChartFillIcon from '@/components/ui/icons/Remix/business/bar-chart-fill.react.svg';
import AlarmWarningLineIcon from '@/components/ui/icons/Remix/system/alarm-warning-line.react.svg';
import NotificationIcon from '@/components/ui/icons/bell.react.svg';
import NotificationUnreadIcon from '@/components/ui/icons/unread-bell.react.svg';
import QuestionLineIcon from '@/components/ui/icons/Remix/system/question-line.react.svg';
import { I18n, TranslationId, useI18n } from '@/locales';
import { useRoutes } from '@/services/routing';
import { isLeaf, RouteItem, RouteWithPath } from '@/services/routing/types';
import TopLevelLink from '@/components/AppWrapper/Menu/TopLevelLink';
import { getBranding } from '@/utils/branding';
import { CluesoContext } from '@/components/AppWrapper/Providers/CluesoTokenProvider';

const icons = {
  accounts: <AddUsersIcon />,
  lists: <ListsIcon />,
  rules: <GavelIcon />,
  reports: <Article />,
  users: <TeamOutlined />,
  'risk-scoring': <AlarmWarningLineIcon />,
  'case-management': <StackLineIcon />,
  help: <QuestionLineIcon />,
  transactions: <TransactionsIcon />,
  settings: <SettingsIcon />,
  dashboard: <BarChartFillIcon />,
  import: <ImportOutlined />,
  sanctions: <GlobeIcon />,
  auditlog: <AuditLogIcon />,
};

const branding = getBranding();

interface Props {
  isCollapsed: boolean;
  onChangeCollapsed: (value: boolean) => void;
}

export default function Menu(props: Props) {
  const { isCollapsed, onChangeCollapsed } = props;
  const [isNotificationsDrawerVisible, setIsNotificationsDrawerVisible] = useState(false);

  const location = useLocation();

  useEffect(() => {
    setIsNotificationsDrawerVisible(false);
  }, [location]);

  const i18n = useI18n();
  const routes = useRoutes();
  const sideBarCollapseContext = useContext(SideBarContext);
  const cluesoToken = useContext(CluesoContext);
  const notificationsFeatureEnabled = useFeatureEnabled('NOTIFICATIONS');

  useEffect(() => {
    if (sideBarCollapseContext.collapseSideBar === 'AUTOMATIC') {
      onChangeCollapsed(true);
    }
  }, [sideBarCollapseContext.collapseSideBar, onChangeCollapsed]);

  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  return (
    <div className={s.root}>
      <Header isCollapsed={isCollapsed} onChangeCollapsed={onChangeCollapsed} />
      <div className={s.menuLinks}>
        <div className={s.menuGroup}>
          {renderItems(
            'menu',
            routes.filter((route) => route.position === 'top'),
            i18n,
            isCollapsed,
            isNotificationsDrawerVisible,
          )}
        </div>
        <div className={s.menuGroup}>
          {[
            notificationsFeatureEnabled && (
              <TopLevelLink
                key="notifications"
                icon={hasUnreadNotifications ? <NotificationUnreadIcon /> : <NotificationIcon />}
                isActive={isNotificationsDrawerVisible}
                isCollapsed={isCollapsed}
                onClick={() => {
                  setIsNotificationsDrawerVisible((x) => !x);
                }}
                testName="notifications"
              >
                Notifications
              </TopLevelLink>
            ),
            ...renderItems(
              'menu',
              routes.filter((route) => route.position === 'bottom'),
              i18n,
              isCollapsed,
              isNotificationsDrawerVisible,
            ),
            <TopLevelLink
              key="help"
              to={`${branding.knowledgeBaseUrl}?token=${cluesoToken}`}
              isExternal={true}
              icon={<QuestionLineIcon />}
              isCollapsed={isCollapsed}
              isActiveHighlightingEnabled={isNotificationsDrawerVisible}
            >
              {i18n('menu.support')}
            </TopLevelLink>,
          ]}
        </div>
      </div>
      <Footer isCollapsed={isCollapsed} />
      {notificationsFeatureEnabled && (
        <Notifications
          isNotificationsDrawerVisible={isNotificationsDrawerVisible}
          setIsNotificationsDrawerVisible={setIsNotificationsDrawerVisible}
          setHasUnreadNotifications={setHasUnreadNotifications}
        />
      )}
    </div>
  );
}

function RenderItem(props: {
  parentTranslationKey: string;
  item: RouteWithPath;
  i18n: I18n;
  isCollapsed: boolean;
  isNotificationsDrawerVisible: boolean;
}) {
  const { i18n, isCollapsed, item, parentTranslationKey, isNotificationsDrawerVisible } = props;
  const disabledByFeature = !useFeaturesEnabled(item.associatedFeatures ?? []);
  const fullKey = `${parentTranslationKey}.${item.name}`;
  const icon = item.icon ? icons[item.icon] : undefined;

  const submenu =
    'routes' in item && !item.hideChildrenInMenu && !item.disabled
      ? item.routes
          .filter(isLeaf)
          .filter((x) => !x.hideInMenu)
          .map((x) => ({
            to: x.path,
            title: i18n(`${fullKey}.${x.name}` as TranslationId),
          }))
      : undefined;
  return (
    <TopLevelLink
      key={item.name}
      to={item.path}
      isCollapsed={isCollapsed}
      isDisabled={item.disabled}
      icon={icon}
      submenu={submenu}
      disabledByFeature={disabledByFeature}
      isActiveHighlightingEnabled={isNotificationsDrawerVisible}
    >
      {i18n(fullKey as TranslationId)}
    </TopLevelLink>
  );
}

function renderItems(
  parentTranslationKey: string,
  items: RouteItem[],
  i18n: I18n,
  isCollapsed: boolean,
  isNotificationsDrawerVisible: boolean,
): React.ReactNode[] {
  return items
    .filter((route) => ('redirect' in route ? false : !route.hideInMenu))
    .map((item): React.ReactNode => {
      if ('redirect' in item) {
        return null;
      }
      return (
        <RenderItem
          parentTranslationKey={parentTranslationKey}
          item={item}
          i18n={i18n}
          isCollapsed={isCollapsed}
          isNotificationsDrawerVisible={isNotificationsDrawerVisible}
        />
      );
    });
}
