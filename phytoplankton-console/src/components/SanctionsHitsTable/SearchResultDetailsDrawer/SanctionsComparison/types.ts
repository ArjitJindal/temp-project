export type SanctionsComparisonTableItemMatch = 'NO_HIT' | 'POTENTIAL_HIT' | 'TRUE_HIT';

export interface SanctionsComparisonTableItem {
  title: string;
  screeningValue: string | number | undefined;
  kycValue: string | number | undefined;
  match: SanctionsComparisonTableItemMatch;
  sources: string[];
}
