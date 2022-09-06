import React, { useRef, useState } from 'react';
import { Tabs } from 'antd';
import { useNavigate, useParams } from 'react-router';
import s from './index.module.less';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import ListTable, { ListTableRef } from '@/pages/lists/ListTable';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/ui/Button';
import NewListModal from '@/pages/lists/NewListModal';
import { ListType } from '@/apis';

function parseListType(str: unknown): ListType {
  if (str === 'users-whitelists') {
    return 'USERS-WHITELISTS';
  } else if (str === 'users-blacklists') {
    return 'USERS-BLACKLISTS';
  }
  throw new Error(`Unknown list type: ${str}`);
}

export default function CreatedLists() {
  const listTypeStr = useParams<'type'>().type;
  const listType = parseListType(listTypeStr);

  const navigate = useNavigate();
  const i18n = useI18n();

  const [isNewModalOpen, setNewModalOpen] = useState(false);
  const whitelistsTableRef: ListTableRef = useRef(null);
  const blacklistsTableRef: ListTableRef = useRef(null);

  return (
    <>
      <PageWrapper title={i18n('menu.lists.created-lists')}>
        <PageTabs
          activeKey={listTypeStr}
          onChange={(key) => {
            navigate(makeUrl(`/lists/:type`, { type: key }), { replace: true });
          }}
          tabBarExtraContent={
            <div className={s.buttons}>
              {listType === 'USERS-WHITELISTS' && (
                <>
                  <Button
                    type="skeleton"
                    size="large"
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
              {listType === 'USERS-BLACKLISTS' && (
                <>
                  <Button type="skeleton" size="large">
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
          <Tabs.TabPane tab="Whitelists" key="users-whitelists">
            <ListTable ref={whitelistsTableRef} listType="USERS-WHITELISTS" />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Blacklists" key="users-blacklists" disabled={true}>
            <ListTable ref={blacklistsTableRef} listType="USERS-BLACKLISTS" />
          </Tabs.TabPane>
        </PageTabs>
      </PageWrapper>
      <NewListModal
        listType={listType}
        isOpen={isNewModalOpen}
        onCancel={() => {
          setNewModalOpen(false);
        }}
        onSuccess={() => {
          setNewModalOpen(false);
          if (listType === 'USERS-WHITELISTS') {
            whitelistsTableRef.current?.reload();
          }
          if (listType === 'USERS-BLACKLISTS') {
            blacklistsTableRef.current?.reload();
          }
        }}
      />
    </>
  );
}
