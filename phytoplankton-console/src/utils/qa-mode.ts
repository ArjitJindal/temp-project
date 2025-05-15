import { useSafeLocalStorageState } from './hooks';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useHasPermissions } from '@/utils/user-utils';

export function useQaMode(): [boolean, (value: boolean) => void] {
  const [qaMode, setQaMode] = useSafeLocalStorageState<boolean>('QA_MODE', false);
  const qaEnabled = useQaEnabled();
  return [qaMode && qaEnabled, setQaMode];
}

export function useQaEnabled(): boolean {
  const qaEnabled = useFeatureEnabled('QA');
  const hasPermissions = useHasPermissions(['case-management:qa:write']);
  return qaEnabled && hasPermissions;
}
