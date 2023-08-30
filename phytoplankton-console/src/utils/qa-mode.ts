import { useLocalStorageState } from 'ahooks';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useHasPermissions } from '@/utils/user-utils';

export function useQaMode(): [boolean, (value: boolean) => void] {
  const [qaMode, setQaMode] = useLocalStorageState<boolean>('QA_MODE', false);
  const qaEnabled = useFeatureEnabled('QA');
  const hasPermissions = useHasPermissions(['case-management:qa:write']);
  return [qaMode && qaEnabled && hasPermissions, setQaMode];
}
