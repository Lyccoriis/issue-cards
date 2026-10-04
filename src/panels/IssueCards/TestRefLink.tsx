import { findTestTarget, openTest } from '@/lib/testLinks';
import { useTestStore } from '@/stores/useTestStore';

export default function TestRefLink({ testRef }: { testRef: string }) {
  const features = useTestStore(s => s.features);
  const target = findTestTarget(features, testRef);

  if (!target) return <span className="mono">{testRef}</span>;

  return (
    <button
      type="button"
      title={`Open ${testRef} in Testing`}
      onClick={() => openTest(target.feature.id, target.step.id)}
      className="mono text-primary underline-offset-2 outline-none hover:underline focus-visible:underline"
    >
      {testRef}
    </button>
  );
}
