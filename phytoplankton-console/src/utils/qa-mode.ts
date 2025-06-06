import { useSafeLocalStorageState } from './hooks';
import { useHasResources } from './user-utils';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export function useQaMode(): [boolean, (value: boolean) => void] {
  const [qaMode, setQaMode] = useSafeLocalStorageState<boolean>('QA_MODE', false);
  const qaEnabled = useQaEnabled();
  return [qaMode && qaEnabled, setQaMode];
}

export function useQaEnabled(): boolean {
  const qaEnabled = useFeatureEnabled('QA');
  const hasPermissions = useHasResources(['write:::case-management/qa/*']);
  return qaEnabled && hasPermissions;
}
