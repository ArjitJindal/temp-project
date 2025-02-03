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
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch/story';
import Modal from '@/components/library/Modal/story';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput/story';
import FilesList from '@/components/files/FilesList/story';
import EmptyDataInfo from '@/components/library/EmptyDataInfo/story';
import CaseGenerationMethodTag from '@/components/library/CaseGenerationMethodTag/story';
import SearchBar from '@/components/library/SearchBar/story';
import ExpandContainer from '@/components/utils/ExpandContainer/story';
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
import SettingsCard from '@/components/library/SettingsCard/story';
import Typography from '@/components/ui/Typography/story';
import Spinner from '@/components/library/Spinner/story';
import Filter from '@/components/library/Filter/story';
import LogicBuilder from '@/components/ui/LogicBuilder/story';
import Tag from '@/components/library/Tag/story';
import AgeRangeInput from '@/components/library/AgeRangeInput/story';
import Avatar from '@/components/library/Avatar/story';
import MarkdownEditor from '@/components/markdown/story';
import NotificationsDrawerList from '@/components/AppWrapper/Menu/Notifications/NotificationsDrawer/story';
import InvestigativeCoPilot from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/story';
import Charts from '@/components/charts/story';
import Skeleton from '@/components/library/Skeleton/story';
import DateRangePicker from '@/components/library/DateRangePicker/story';
import AiAlertSummary from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/AiAlertSummary/story';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard/story';
import RiskSimulationChart from '@/pages/risk-levels/configure/components/Charts/story';
import DeltaChart from '@/pages/rules/RuleConfiguration/RuleConfigurationSimulation/SimulationStatistics/DeltaChart/story';

const config: Config = [
  {
    key: 'library',
    title: 'Library',
    components: [
      {
        key: 'Selection group',
        story: SelectionGroup,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=214-8964&mode=dev',
      },
      {
        key: 'Checkbox',
        story: Checkbox,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=360%3A10096&mode=dev',
      },
      {
        key: 'Radio',
        story: Radio,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=426%3A10223&mode=dev',
      },
      // todo: Popup
      // todo: Button group
      {
        key: 'Alert',
        story: Alert,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=198%3A8322&mode=dev',
      },
      {
        key: 'Message',
        story: Message,
        designLink:
          'https://www.figma.com/design/8f2OFrSxBjNuo4dtV0twxb/Aegis-Design-System?node-id=168-2816',
      },
      {
        key: 'Vertical menu',
        story: VerticalMenu,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=196%3A8365&mode=dev',
      },
      {
        key: 'Stepper',
        story: Stepper,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=214%3A8495&mode=dev',
      },
      // todo: Devider
      // todo: Input field
      {
        key: 'Text input',
        story: TextInput,
        alternativeNames: ['Input field'],
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=0%3A1&mode=dev',
      },
      {
        key: 'Select',
        story: Select,
        alternativeNames: ['Input field'],
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=264%3A11291&mode=dev',
      },
      {
        key: 'Number input',
        story: NumberInput,
        alternativeNames: ['Input field'],
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=0%3A1&mode=dev',
      },
      {
        key: 'Text area',
        story: TextArea,
        alternativeNames: ['Text field'],
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=903%3A16410&mode=dev',
      },
      {
        key: 'Tag',
        story: Tag,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=318%3A9125&mode=dev',
      },
      {
        key: 'Pagination',
        story: Pagination,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=319%3A9134&mode=dev',
      },
      {
        key: 'Button',
        story: Button,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=323%3A9201&mode=dev',
      },
      // todo: Analitics should not be here
      // todo: Export should not be here
      // todo: Invistigative co-pilot should not be here
      {
        key: 'Toggle',
        story: Toggle,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=1%3A2794&mode=dev',
      },
      {
        key: 'Tabs',
        story: Tabs,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=342%3A10016&mode=dev',
      },
      // todo: TreeMenu
      {
        key: 'Tooltip',
        story: Tooltip,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=391%3A10151&mode=dev',
      },
      {
        key: 'Card',
        story: Card,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=393%3A10080&mode=dev',
      },
      {
        key: 'Dropdown',
        story: Dropdown,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=393%3A10159&mode=dev',
      },
      {
        key: 'Segmented control',
        story: SegmentedControl,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=440%3A10103&mode=dev',
      },
      {
        key: 'Filter',
        story: Filter,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=442%3A10187&mode=dev',
      },
      {
        key: 'Table',
        story: Table,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=912%3A16408&mode=dev',
      },
      // todo: add scrollbar
      {
        key: 'Risk level switch',
        story: RiskLevelSwitch,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=1116%3A23510&mode=dev',
      },
      {
        key: 'Drawer',
        story: Drawer,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=1545%3A23745&mode=dev',
      },
      {
        key: 'Modal',
        story: Modal,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=1545%3A23745&mode=dev',
      },
      // todo: Side navigation should not be here
      // todo: Add progress bar
      {
        key: 'Empty data info',
        story: EmptyDataInfo,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=3011%3A33540&mode=dev',
      },
      // todo: Add file upload
      {
        key: 'Search bar',
        story: SearchBar,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?type=design&node-id=3831%3A5932&mode=dev',
      },
      // todo: Add loader
      // todo: Headers should not be here
      // todo: Add priority
      // todo: Multiselect rows
      {
        key: 'Skeleton',
        story: Skeleton,
        designLink:
          'https://www.figma.com/file/8pFXj0S40ULQbCSmhMJEJ4/Design-system?node-id=4557-5787&mode=dev',
      },
    ],
  },
  {
    key: 'to-add',
    title: 'To add to library',
    components: [
      {
        key: 'DateRangePicker',
        story: DateRangePicker,
      },
      {
        key: 'Avatar',
        story: Avatar,
      },
      {
        key: 'Slider',
        story: Slider,
      },
      {
        key: 'Age range input',
        story: AgeRangeInput,
      },

      {
        key: 'Case generation method tag',
        story: CaseGenerationMethodTag,
      },
      {
        key: 'StepButtons',
        story: StepButtons,
      },
      {
        key: 'Form',
        story: Form,
      },
      {
        key: 'Label',
        story: Label,
      },
      {
        key: 'QuickFilter',
        story: QuickFilter,
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
        key: 'Spinner',
        story: Spinner,
      },
      {
        key: 'MarkdownEditor',
        story: MarkdownEditor,
      },
    ],
  },
  {
    key: 'utils',
    title: 'Utils',
    components: [
      {
        key: 'ExpandContainer',
        story: ExpandContainer,
      },
    ],
  },
  {
    key: 'misc',
    title: 'Miscellaneous',
    components: [
      {
        key: '@/components/charts',
        story: Charts,
      },
      {
        key: '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot',
        story: InvestigativeCoPilot,
      },
      {
        key: '@/pages/risk-levels/configure/components/Charts',
        story: RiskSimulationChart,
      },
      {
        key: '@/pages/rules/RuleConfiguration/RuleConfigurationSimulation/SimulationStatistics/DeltaChart',
        story: DeltaChart,
      },
      {
        key: '@/pages/users-item/UserDetails/EntityPropertiesCard',
        story: EntityPropertiesCard,
      },
      {
        key: '@/components/AppWrapper/Menu/NotificationsDrawer',
        story: NotificationsDrawerList,
      },
      {
        key: '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/AiAlertSummary/story',
        story: AiAlertSummary,
      },
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
        key: '@/components/ui/LogicBuilder',
        story: LogicBuilder,
      },
      {
        key: 'JsonSchemaEditor',
        story: JsonSchemaEditor,
      },
      {
        key: 'CrudEntitiesTable',
        story: CrudEntitiesTable,
      },
      {
        key: 'DrawerStepperJsonSchemaForm',
        story: DrawerStepperJsonSchemaForm,
      },
      {
        key: 'Settings Card',
        story: SettingsCard,
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
      <AlertComponent type="ERROR">
        {`Component not found: ${params.component ?? '(empty)'}`}
      </AlertComponent>
    );
  }

  const Story = component.story;

  return (
    <Component
      title={component.key}
      designLink={component.designLink}
      alternativeNames={component.alternativeNames}
    >
      <Story />
    </Component>
  );
}

function CategoryPage() {
  const params = useParams();
  const category = config.find((x) => x.key === params.category);
  if (category == null) {
    return (
      <AlertComponent type="ERROR">
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
