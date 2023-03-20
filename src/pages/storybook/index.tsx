import React from 'react';
import { Navigate, Route, Routes } from 'react-router';
import s from './index.module.less';
import CategoriesMenu from './CategoriesMenu';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/library/Button/story';
import Label from '@/components/library/Label/story';
import Checkbox from '@/components/library/Checkbox/story';
import Select from '@/components/library/Select/story';
import TextInput from '@/components/library/TextInput/story';
import NumberInput from '@/components/library/NumberInput/story';
import Radio from '@/components/library/Radio/story';
import VerticalMenu from '@/components/library/VerticalMenu/story';
import StepButtons from '@/components/library/StepButtons/story';
import SelectionGroup from '@/components/library/SelectionGroup/story';
import Stepper from '@/components/library/Stepper/story';
import Card from '@/components/ui/Card/story';
import Form from '@/components/library/Form/story';
import Drawer from '@/components/library/Drawer/story';
import Alert from '@/components/library/Alert/story';
import QuickFilter from '@/components/library/QuickFilter/story';
import Pagination from '@/components/library/Pagination/story';
import Message from '@/components/library/Message/story';
import Dropdown from '@/components/library/Dropdown/story';
import SegmentedControl from '@/components/library/SegmentedControl/story';
import JsonSchemaEditor from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/story';
import { Component } from '@/pages/storybook/components';
import Tooltip from '@/components/library/Tooltip/story';
import Toggle from '@/components/library/Toggle/story';
import Tabs from '@/components/library/Tabs/story';
import TextArea from '@/components/library/TextArea/story';
import Slider from '@/components/library/Slider/story';

interface StoryProps {}

interface CategoryComponent {
  component: string;
  story: React.FunctionComponent<StoryProps>;
}

interface Category {
  key: string;
  category: string;
  components: CategoryComponent[];
}

type Config = Category[];

const config: Config = [
  {
    key: 'library',
    category: 'Library',
    components: [
      {
        component: 'VerticalMenu',
        story: VerticalMenu,
      },
      {
        component: 'Stepper',
        story: Stepper,
      },
      {
        component: 'StepButtons',
        story: StepButtons,
      },
      {
        component: 'SegmentedControl',
        story: SegmentedControl,
      },
      {
        component: 'Tabs',
        story: Tabs,
      },
      {
        component: 'Pagination',
        story: Pagination,
      },
      {
        component: 'Alert',
        story: Alert,
      },
      {
        component: 'Message',
        story: Message,
      },
      {
        component: 'Tooltip',
        story: Tooltip,
      },
      {
        component: 'Form',
        story: Form,
      },
      {
        component: 'Button',
        story: Button,
      },
      {
        component: 'Label',
        story: Label,
      },
      {
        component: 'Select',
        story: Select,
      },
      {
        component: 'TextInput',
        story: TextInput,
      },
      {
        component: 'NumberInput',
        story: NumberInput,
      },
      {
        component: 'Radio',
        story: Radio,
      },
      {
        component: 'Checkbox',
        story: Checkbox,
      },
      {
        component: 'SelectionGroup',
        story: SelectionGroup,
      },
      {
        component: 'TextArea',
        story: TextArea,
      },
      {
        component: 'Toggle',
        story: Toggle,
      },
      {
        component: 'QuickFilter',
        story: QuickFilter,
      },
      {
        component: 'Drawer',
        story: Drawer,
      },
      {
        component: 'Card',
        story: Card,
      },
      {
        component: 'Dropdown',
        story: Dropdown,
      },
    ],
  },
  {
    key: 'to_add',
    category: 'To add',
    components: [
      {
        component: 'Slider',
        story: Slider,
      },
    ],
  },
  {
    key: 'misc',
    category: 'Misc',
    components: [
      {
        component: '@/pages/rules/RuleConfigurationDrawer/RuleParametersStep/JsonSchemaEditor',
        story: JsonSchemaEditor,
      },
    ],
  },
];

export default function () {
  // todo: i18n
  return (
    <div className={s.root}>
      <div className={s.menu}>
        <CategoriesMenu
          items={config.map((category) => ({ key: category.key, title: category.category }))}
          onMakeUrl={(category) => makeUrl(`/storybook/:category`, { category })}
        />
      </div>
      {config.length > 0 && (
        <div className={s.content}>
          <Routes>
            {config.map((category) => (
              <Route
                key={category.key}
                path={makeUrl(`/storybook/:category`, { category: category.key })}
                element={
                  <>
                    {category.components.map((component) => {
                      const Story = component.story;
                      return (
                        <Component key={component.component} title={component.component}>
                          <Story />
                        </Component>
                      );
                    })}
                  </>
                }
              />
            ))}
            <Route
              path="/storybook"
              element={
                <Navigate
                  replace
                  to={makeUrl(`/storybook/:category`, { category: config[0].key })}
                />
              }
            />
          </Routes>
        </div>
      )}
    </div>
  );
}
