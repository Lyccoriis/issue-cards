import { toast } from 'sonner';

import { errorText } from '@/lib/supabase';
import { useIssueStore } from '@/stores/useIssueStore';
import { useUiStore } from '@/stores/useUiStore';
import ReasonDialog from './ReasonDialog';
import RejectDialog from './RejectDialog';

export default function StatusDialogs() {
  const cards = useIssueStore(s => s.cards);
  const setStatus = useIssueStore(s => s.setStatus);

  const fixCardId = useUiStore(s => s.fixCardId);
  const close = useUiStore(s => s.closeStatusAsk);

  const fixing = cards.find(c => c.id === fixCardId) ?? null;

  async function run(work: () => Promise<unknown>, done: string) {
    try {
      await work();
      toast.success(done);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <>
      <ReasonDialog
        open={Boolean(fixing)}
        onOpenChange={open => !open && close()}
        title={fixing ? `Mark ${fixing.id} fixed` : ''}
        label="Test procedure"
        description="How to check the issue is gone, based on what you actually tried."
        versionLabel="Version it was fixed in"
        confirmLabel="Mark fixed"
        initial={fixing?.testProcedure ?? ''}
        onConfirm={(text, version) =>
          fixing
            ? run(
                () => setStatus(fixing.id, 'fixed', { testProcedure: text, version }),
                `${fixing.id} marked fixed`,
              )
            : Promise.resolve()
        }
      />

      <RejectDialog />
    </>
  );
}
