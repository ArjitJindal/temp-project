import React, { useRef, useState } from 'react';
import { Tabs } from 'antd';
import { useNavigate, useParams } from 'react-router';
import s from './index.module.less';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import ListTable, { ListTableRef } from '@/pages/lists/ListTable';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/library/Button';
import NewListDrawer from '@/pages/lists/NewListDrawer';
import { parseListType, stringifyListType } from '@/pages/lists/helpers';
import { usePageViewTracker } from '@/utils/tracker';
import { useHasPermissions } from '@/utils/user-utils';

export default function CreatedLists() {
  usePageViewTracker('Created Lists Page');
  const params = useParams<'type'>();
  const listType = parseListType(params.type);

  const navigate = useNavigate();
  const i18n = useI18n();

  const [isNewModalOpen, setNewModalOpen] = useState(false);
  const whitelistsTableRef: ListTableRef = useRef(null);
  const blacklistsTableRef: ListTableRef = useRef(null);
  const hasListWritePermissions = useHasPermissions(['lists:all:write']);

  return (
    <>
      <PageWrapper title={i18n('menu.lists.created-lists')}>
        <PageTabs
          activeKey={stringifyListType(listType)}
          onChange={(key) => {
            navigate(makeUrl(`/lists/:type`, { type: key }), { replace: true });
          }}
          tabBarExtraContent={
            <div className={s.buttons}>
              {listType === 'WHITELIST' && (
                <>
                  <Button
                    size="LARGE"
                    isDisabled={!hasListWritePermissions}
                    onClick={() => {
                      setNewModalOpen(true);
                    }}
                  >
                    Add New Whitelist
                  </Button>
                  {/*<Button type="skeleton" size="large">*/}
                  {/*  Upload Whitelist*/}
                  {/*</Button>*/}
                </>
              )}
              {listType === 'BLACKLIST' && (
                <>
                  <Button
                    size="LARGE"
                    isDisabled={!hasListWritePermissions}
                    onClick={() => {
                      setNewModalOpen(true);
                    }}
                  >
                    Add New Blacklist
                  </Button>
                  {/*<Button type="skeleton" size="large">*/}
                  {/*  Upload Blacklist*/}
                  {/*</Button>*/}
                </>
              )}
            </div>
          }
        >
          <Tabs.TabPane tab="Whitelists" key="whitelist">
            <ListTable ref={whitelistsTableRef} listType="WHITELIST" />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Blacklists" key="blacklist">
            <ListTable ref={blacklistsTableRef} listType="BLACKLIST" />
          </Tabs.TabPane>
        </PageTabs>
      </PageWrapper>
      <NewListDrawer
        listType={listType}
        isOpen={isNewModalOpen}
        onCancel={() => {
          setNewModalOpen(false);
        }}
        onSuccess={() => {
          setNewModalOpen(false);
          if (listType === 'WHITELIST') {
            whitelistsTableRef.current?.reload();
          }
          if (listType === 'BLACKLIST') {
            blacklistsTableRef.current?.reload();
          }
        }}
      />
    </>
  );
}
