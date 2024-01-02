import { Navigate, Route, Routes, useParams } from 'react-router';
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
import DrawerStepperJsonSchemaForm from '@/components/library/DrawerStepperJsonSchemaForm/story';
import Alert from '@/components/library/Alert/story';
import AlertComponent from '@/components/library/Alert';
import QuickFilter from '@/components/library/QuickFilter/story';
import Pagination from '@/components/library/Pagination/story';
import Message from '@/components/library/Message/story';
import Dropdown from '@/components/library/Dropdown/story';
import SegmentedControl from '@/components/library/SegmentedControl/story';
import JsonSchemaEditor from '@/components/library/JsonSchemaEditor/story';
import Tooltip from '@/components/library/Tooltip/story';
import Toggle from '@/components/library/Toggle/story';
import Tabs from '@/components/library/Tabs/story';
import TextArea from '@/components/library/TextArea/story';
import Slider from '@/components/library/Slider/story';
import Table from '@/components/library/Table/story';
import CrudEntitiesTable from '@/components/library/CrudEntitiesTable/story';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay/story';
import RiskLevelTag from '@/components/library/RiskLevelTag/story';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch/story';
import Modal from '@/components/library/Modal/story';
import TransactionTypeTag from '@/components/library/TransactionTypeTag/story';
import CaseStatusTag from '@/components/library/CaseStatusTag/story';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput/story';
import FilesList from '@/components/files/FilesList/story';
import EmptyDataInfo from '@/components/library/EmptyDataInfo/story';
import CaseGenerationMethodTag from '@/components/library/CaseGenerationMethodTag/story';
import { Category, Config } from '@/pages/storybook/types';
import {
  CATEGORY_ROUTE,
  CATEGORY_SEGMENT,
  COMPONENT_ROUTE,
  COMPONENT_SEGMENT,
  ROOT_SEGMENT,
} from '@/pages/storybook/routes';
import { Component } from '@/pages/storybook/components';
import Widget from '@/components/library/Widget/story';
import WidgetGrid from '@/components/library/WidgetGrid/story';
import Narrative from '@/components/Narrative/story';
import Line from '@/pages/dashboard/analysis/components/charts/Line/story';
import SettingsCard from '@/components/library/SettingsCard/story';
import Typography from '@/components/ui/Typography/story';
import Spinner from '@/components/library/Spinner/story';
import Tag from '@/components/library/Tag/story';

const config: Config = [
  {
    key: 'library',
    title: 'Library',
    components: [
      {
        key: 'Tag',
        story: Tag,
      },
      {
        key: 'TransactionTypeTag',
        story: TransactionTypeTag,
      },
      {
        key: 'RiskLevelSwitch',
        story: RiskLevelSwitch,
      },
      {
        key: 'CaseStatusTag',
        story: CaseStatusTag,
      },
      {
        key: 'CaseGenerationMethodTag',
        story: CaseGenerationMethodTag,
      },
      {
        key: 'Table',
        story: Table,
      },
      {
        key: 'CrudEntitiesTable',
        story: CrudEntitiesTable,
      },
      {
        key: 'VerticalMenu',
        story: VerticalMenu,
      },
      {
        key: 'Stepper',
        story: Stepper,
      },
      {
        key: 'StepButtons',
        story: StepButtons,
      },
      {
        key: 'SegmentedControl',
        story: SegmentedControl,
      },
      {
        key: 'Tabs',
        story: Tabs,
      },
      {
        key: 'Pagination',
        story: Pagination,
      },
      {
        key: 'Alert',
        story: Alert,
      },
      {
        key: 'Message',
        story: Message,
      },
      {
        key: 'Tooltip',
        story: Tooltip,
      },
      {
        key: 'Form',
        story: Form,
      },
      {
        key: 'Button',
        story: Button,
      },
      {
        key: 'Label',
        story: Label,
      },
      {
        key: 'Select',
        story: Select,
      },
      {
        key: 'TextInput',
        story: TextInput,
      },
      {
        key: 'NumberInput',
        story: NumberInput,
      },
      {
        key: 'Radio',
        story: Radio,
      },
      {
        key: 'Checkbox',
        story: Checkbox,
      },
      {
        key: 'SelectionGroup',
        story: SelectionGroup,
      },
      {
        key: 'TextArea',
        story: TextArea,
      },
      {
        key: 'Toggle',
        story: Toggle,
      },
      {
        key: 'QuickFilter',
        story: QuickFilter,
      },
      {
        key: 'Drawer',
        story: Drawer,
      },
      {
        key: 'DrawerStepperJsonSchemaForm',
        story: DrawerStepperJsonSchemaForm,
      },
      {
        key: 'Card',
        story: Card,
      },
      {
        key: 'Dropdown',
        story: Dropdown,
      },
      {
        key: 'RiskLevelTag',
        story: RiskLevelTag,
      },
      {
        key: 'Modal',
        story: Modal,
      },
      {
        key: 'EmptyDataInfo',
        story: EmptyDataInfo,
      },
      {
        key: 'Widget',
        story: Widget,
      },
      {
        key: 'WidgetGrid',
        story: WidgetGrid,
      },
      {
        key: 'Narrative',
        story: Narrative,
      },
      {
        key: 'Settings Card',
        story: SettingsCard,
      },
      {
        key: 'Spinner',
        story: Spinner,
      },
    ],
  },
  {
    key: 'to_add',
    title: 'To add',
    components: [
      {
        key: 'Slider',
        story: Slider,
      },
    ],
  },
  {
    key: 'misc',
    title: 'Misc',
    components: [
      {
        key: '@/components/ui/Typography',
        story: Typography,
      },
      {
        key: '@/components/ui/FilesDraggerInput',
        story: FilesDraggerInput,
      },
      {
        key: '@/components/files/FilesList',
        story: FilesList,
      },
      {
        key: '@/components/ui/RiskScoreDisplay',
        story: RiskScoreDisplay,
      },
      {
        key: '@/pages/dashboard/analysis/components/charts/Line/story',
        story: Line,
      },
      {
        key: 'JsonSchemaEditor',
        story: JsonSchemaEditor,
      },
    ],
  },
];

export default function () {
  // todo: i18n
  return (
    <Routes>
      <Route
        path={`/${ROOT_SEGMENT}/*`}
        element={
          <div className={s.root}>
            <div className={s.menu}>
              <CategoriesMenu items={config} />
            </div>
            {config.length > 0 && (
              <div className={s.content}>
                <Routes>
                  <Route
                    index
                    element={
                      <Navigate replace to={makeUrl(CATEGORY_ROUTE, { category: config[0].key })} />
                    }
                  />
                  <Route path={`${CATEGORY_SEGMENT}/*`} element={<CategoryPage />} />
                </Routes>
              </div>
            )}
          </div>
        }
      />
    </Routes>
  );
}

function ComponentPage(props: { category: Category }) {
  const { category } = props;
  const params = useParams();
  const component = category.components.find((x) => x.key === params.component);
  if (component == null) {
    return (
      <AlertComponent type="error">
        {`Component not found: ${params.component ?? '(empty)'}`}
      </AlertComponent>
    );
  }

  const Story = component.story;

  return (
    <Component title={component.key}>
      <Story />
    </Component>
  );
}

function CategoryPage() {
  const params = useParams();
  const category = config.find((x) => x.key === params.category);
  if (category == null) {
    return (
      <AlertComponent type="error">
        {`Category not found: ${params.category ?? '(empty)'}`}
      </AlertComponent>
    );
  }

  return (
    <Routes>
      <Route
        index
        element={
          <Navigate
            replace
            to={makeUrl(COMPONENT_ROUTE, {
              category: category.key,
              component: category.components[0].key,
            })}
          />
        }
      />
      <Route path={`${COMPONENT_SEGMENT}/*`} element={<ComponentPage category={category} />} />
    </Routes>
  );
}
