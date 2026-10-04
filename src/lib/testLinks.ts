import { useIssueStore } from '@/stores/useIssueStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useTestStore } from '@/stores/useTestStore';
import type { IssueCard, TestFeature, TestStep } from '@/types';

export function testRefOf(feature: TestFeature, step: TestStep): string {
  return `${feature.key} ${step.code}`;
}

export function findTestTarget(
  features: TestFeature[],
  ref: string,
): { feature: TestFeature; step: TestStep } | null {
  const [key, code] = ref.trim().split(/\s+/);
  const feature = features.find(f => f.key === key);
  const step = feature?.groups.flatMap(g => g.steps).find(s => s.code === code);
  return feature && step ? { feature, step } : null;
}

export function issuesOfFeature(cards: IssueCard[], feature: TestFeature): IssueCard[] {
  return cards
    .filter(c => c.testRef.startsWith(`${feature.key} `))
    .sort((a, b) => b.timeOpened.localeCompare(a.timeOpened));
}

export function issueOfStep(cards: IssueCard[], ref: string): IssueCard | null {
  return (
    cards
      .filter(c => c.testRef === ref)
      .sort((a, b) => b.timeOpened.localeCompare(a.timeOpened))[0] ?? null
  );
}

export function openTest(featureId: string, stepId?: string): void {
  useIssueStore.getState().select(null);
  useLayoutStore.getState().setActivePanel('testing');
  const tests = useTestStore.getState();
  tests.select(featureId);
  if (stepId) tests.focus(stepId);
}

export function openIssue(cardId: string): void {
  useTestStore.getState().select(null);
  useLayoutStore.getState().setActivePanel('issue-cards');
  useIssueStore.getState().select(cardId);
}
