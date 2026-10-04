import { useDeferredValue, useMemo } from 'react';
import { FlaskConical, Loader2, Plus, RotateCcw, Search, SearchX } from 'lucide-react';

import PanelShell from '@/components/layout/PanelShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore, usePermissions } from '@/stores/useAuthStore';
import { useTestStore, visibleFeatures } from '@/stores/useTestStore';
import { useUiStore } from '@/stores/useUiStore';
import FeatureFormDialog from './FeatureFormDialog';
import FeatureSheet from './FeatureSheet';
import FeatureTable from './FeatureTable';
import TestFilterStrip from './TestFilterStrip';

export default function TestingPanel() {
  const can = usePermissions();
  const workspaceId = useAuthStore(s => s.activeWorkspaceId);
  const workspaceName = useAuthStore(
    s => s.workspaces.find(w => w.id === s.activeWorkspaceId)?.name ?? '',
  );

  const features = useTestStore(s => s.features);
  const loading = useTestStore(s => s.loading);
  const loaded = useTestStore(s => s.loaded);
  const error = useTestStore(s => s.error);
  const query = useTestStore(s => s.query);
  const filters = useTestStore(s => s.filters);
  const sortKey = useTestStore(s => s.sortKey);
  const sortDir = useTestStore(s => s.sortDir);
  const selectedId = useTestStore(s => s.selectedId);
  const load = useTestStore(s => s.load);
  const setQuery = useTestStore(s => s.setQuery);
  const clearFilters = useTestStore(s => s.clearFilters);

  const openForm = useUiStore(s => s.openTestForm);

  const listQuery = useDeferredValue(query);
  const shown = useMemo(
    () => visibleFeatures({ features, filters, query: listQuery, sortKey, sortDir }),
    [features, filters, listQuery, sortKey, sortDir],
  );
  const selected = features.find(f => f.id === selectedId) ?? null;

  const actions = (
    <>
      <Button variant="outline" size="sm" onClick={() => void load(true)}>
        {loading ? (
          <Loader2 size={15} strokeWidth={1.6} className="animate-spin" />
        ) : (
          <RotateCcw size={15} strokeWidth={1.6} />
        )}
        Refresh
      </Button>
      {can.writeFeatures && (
        <Button size="sm" onClick={() => openForm(null)} disabled={!workspaceId}>
          <Plus size={15} strokeWidth={1.6} />
          New feature
        </Button>
      )}
    </>
  );

  const topbar = (
    <>
      <div className="flex flex-none items-center gap-2 overflow-hidden border-b border-border px-[22px] py-2">
        <InputGroup className="w-[420px] min-w-[140px] max-w-full shrink">
          <InputGroupAddon>
            <Search size={15} strokeWidth={1.6} />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            placeholder="Search name, what was done, steps"
            onChange={e => setQuery(e.target.value)}
          />
        </InputGroup>

        <span className="tnum ml-auto hidden whitespace-nowrap rounded-md border border-border px-2 py-1 text-[12px] text-muted-foreground md:inline-block">
          {shown.length} of {features.length} shown
        </span>
      </div>

      {features.length > 0 && <TestFilterStrip features={features} />}
    </>
  );

  let body: React.ReactNode;
  if (error) {
    body = (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Could not load the tests</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  } else if (!loaded) {
    body = (
      <div className="flex flex-col gap-2 px-[22px] py-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[38px] w-full" />
        ))}
      </div>
    );
  } else if (features.length === 0) {
    body = (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FlaskConical size={15} strokeWidth={1.6} />
          </EmptyMedia>
          <EmptyTitle>Nothing to test yet</EmptyTitle>
          <EmptyDescription>
            {can.writeFeatures
              ? 'Add a feature and say what to try. Testers answer each step.'
              : 'Nothing has been added here yet.'}
          </EmptyDescription>
        </EmptyHeader>
        {can.writeFeatures && (
          <EmptyContent>
            <Button size="sm" onClick={() => openForm(null)} disabled={!workspaceId}>
              <Plus size={15} strokeWidth={1.6} />
              New feature
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  } else if (shown.length === 0) {
    body = (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX size={15} strokeWidth={1.6} />
          </EmptyMedia>
          <EmptyTitle>No features match</EmptyTitle>
          <EmptyDescription>
            The search and the filters above are hiding all {features.length} features.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </EmptyContent>
      </Empty>
    );
  } else {
    body = (
      <ScrollArea className="h-full">
        <FeatureTable features={shown} />
      </ScrollArea>
    );
  }

  return (
    <PanelShell
      title="Testing"
      description={
        workspaceName
          ? `${workspaceName}, ${features.length} ${features.length === 1 ? 'feature' : 'features'}`
          : 'No workspace open'
      }
      actions={actions}
      topbar={topbar}
      scroll={false}
      width={0}
    >
      {body}

      <FeatureSheet feature={selected} />

      <FeatureFormDialog />
    </PanelShell>
  );
}
