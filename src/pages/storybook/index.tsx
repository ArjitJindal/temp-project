import React from 'react';
import { Navigate, Route, Routes } from 'react-router';
import s from './index.module.less';
import CategoriesMenu from './CategoriesMenu';
import { makeUrl } from '@/utils/routing';
import Label from '@/components/library/Label/story';
import Checkbox from '@/components/library/Checkbox/story';
import Select from '@/components/library/Select/story';
import TextInput from '@/components/library/TextInput/story';
import NumberInput from '@/components/library/NumberInput/story';
import Radio from '@/components/library/Radio/story';
import LeftNav from '@/components/library/VerticalMenu/story';
import StepButtons from '@/components/library/ButtonGroup/story';
import SelectionGroup from '@/components/library/SelectionGroup/story';
import Stepper from '@/components/library/Stepper/story';
import Card from '@/components/ui/Card/story';
import Form from '@/components/library/Form/story';
import Drawer from '@/components/library/Drawer/story';
import Alert from '@/components/library/Alert/story';
import { Component } from '@/pages/storybook/components';

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
    key: 'navigation',
    category: 'Navigation',
    components: [
      {
        component: 'LeftNav',
        story: LeftNav,
      },
      {
        component: 'Stepper',
        story: Stepper,
      },
      {
        component: 'StepButtons',
        story: StepButtons,
      },
    ],
  },
  {
    key: 'feedback',
    category: 'Feedback',
    components: [
      {
        component: 'Alert',
        story: Alert,
      },
    ],
  },
  {
    key: 'forms',
    category: 'Forms',
    components: [
      {
        component: 'Form',
        story: Form,
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
    ],
  },
  {
    key: 'layout',
    category: 'Layout',
    components: [
      {
        component: 'Drawer',
        story: Drawer,
      },
      {
        component: 'Card',
        story: Card,
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
