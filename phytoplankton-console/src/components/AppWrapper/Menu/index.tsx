import { ImportOutlined } from '@ant-design/icons';
import React, { useContext, useEffect } from 'react';
import { SideBarContext } from '../Providers/SidebarProvider';
import { useFeatureEnabled, useFeaturesEnabled } from '../Providers/SettingsProvider';
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
import Article from '@/components/ui/icons/Remix/document/article-line.react.svg';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import BarChartFillIcon from '@/components/ui/icons/Remix/business/bar-chart-fill.react.svg';
import QuestionLineIcon from '@/components/ui/icons/Remix/system/question-line.react.svg';
import AlarmWarningLineIcon from '@/components/ui/icons/Remix/system/alarm-warning-line.react.svg';
import { I18n, TranslationId, useI18n } from '@/locales';
import { useRoutes } from '@/services/routing';
import { isLeaf, RouteItem } from '@/services/routing/types';
import { getBranding } from '@/utils/branding';
import TopLevelLink from '@/components/AppWrapper/Menu/TopLevelLink';

const icons = {
  accounts: <AddUsersIcon />,
  lists: <ListsIcon />,
  rules: <GavelIcon />,
  reports: <Article />,
  users: <TeamOutlined />,
  'risk-scoring': <AlarmWarningLineIcon />,
  'case-management': <StackLineIcon />,
  transactions: <TransactionsIcon />,
  settings: <SettingsIcon />,
  dashboard: <BarChartFillIcon />,
  import: <ImportOutlined />,
  sanctions: <GlobeIcon />,
  auditlog: <AuditLogIcon />,
};

const branding = getBranding();

function renderItems(
  parentTranslationKey: string,
  items: RouteItem[],
  i18n: I18n,
  isCollapsed: boolean,
): React.ReactNode[] {
  return items
    .filter((route) => ('redirect' in route ? false : !route.hideInMenu))
    .map((item): React.ReactNode => {
      if ('redirect' in item) {
        return null;
      }
      const fullKey = `${parentTranslationKey}.${item.name}`;
      const icon = item.icon ? icons[item.icon] : undefined;

      const submenu =
        'routes' in item && !item.hideChildrenInMenu
          ? item.routes
              .filter(isLeaf)
              .filter((x) => !x.hideInMenu)
              .map((x) => ({
                to: x.path,
                title: i18n(`${fullKey}.${x.name}` as TranslationId),
              }))
          : undefined;
      const disabledByFeature = !useFeaturesEnabled(item.associatedFeatures ?? []);
      return (
        <TopLevelLink
          key={item.name}
          to={item.path}
          isCollapsed={isCollapsed}
          isDisabled={item.disabled}
          icon={icon}
          submenu={submenu}
          disabledByFeature={disabledByFeature}
        >
          {i18n(fullKey as TranslationId)}
        </TopLevelLink>
      );
    });
}

export default function Menu(props: {
  isCollapsed: boolean;
  onChangeCollapsed: (value: boolean) => void;
}) {
  const { isCollapsed, onChangeCollapsed } = props;

  const i18n = useI18n();
  const routes = useRoutes();
  const isHelpCenterEnabled = useFeatureEnabled('HELP_CENTER');
  const sideBarCollapseContext = useContext(SideBarContext);

  useEffect(() => {
    if (sideBarCollapseContext.collapseSideBar === 'AUTOMATIC') {
      onChangeCollapsed(true);
    }
  }, [sideBarCollapseContext.collapseSideBar, onChangeCollapsed]);

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
          )}
        </div>
        <div className={s.menuGroup}>
          {renderItems(
            'menu',
            routes.filter((route) => route.position === 'bottom'),
            i18n,
            isCollapsed,
          ).concat([
            ...(isHelpCenterEnabled && branding.knowledgeBaseUrl
              ? [
                  <TopLevelLink
                    to={branding.knowledgeBaseUrl}
                    isExternal={true}
                    icon={<QuestionLineIcon />}
                    isCollapsed={isCollapsed}
                  >
                    Help
                  </TopLevelLink>,
                ]
              : []),
          ])}
        </div>
      </div>
      <Footer isCollapsed={isCollapsed} />
    </div>
  );
}
