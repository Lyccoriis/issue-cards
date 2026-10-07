import { useEffect, useMemo, useState } from 'react';
import { CircleCheck, FileUp, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';

import MentionField from '@/components/shared/MentionField';
import VersionSelect from '@/components/shared/VersionSelect';
import WhyDisabled from '@/components/shared/WhyDisabled';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorText } from '@/lib/supabase';
import { formatTestList, parseFeatureFile, parseTestList } from '@/lib/testParser';
import { usePermissions } from '@/stores/useAuthStore';
import { useTestStore } from '@/stores/useTestStore';
import { useUiStore } from '@/stores/useUiStore';

const EXAMPLE = `A  Boarding
setup: one train, two seats, station placed
A1  stand on the platform and press the button | doors open
A2  press it five times fast | no stuck door

B  Save and reload
B1  save the world and load it again | the train is where it was`;

export default function FeatureFormDialog() {
  const open = useUiStore(s => s.testFormOpen);
  const editingId = useUiStore(s => s.editingFeatureId);
  const close = useUiStore(s => s.closeTestForm);
  const save = useTestStore(s => s.save);
  const can = usePermissions();

  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [done, setDone] = useState('');
  const [list, setList] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const editing = useTestStore.getState().features.find(f => f.id === editingId) ?? null;
    setTitle(editing?.title ?? '');
    setVersion(editing?.version ?? '');
    setDone(editing?.done ?? '');
    setList(
      editing
        ? formatTestList(
            editing.groups.map(g => ({
              letter: g.letter,
              title: g.title,
              setup: g.setup,
              steps: g.steps.map(s => ({ num: s.num, how: s.how, expected: s.expected })),
            })),
          )
        : '',
    );
    setSaving(false);
  }, [open, editingId]);

  async function importFile() {
    const file = await window.api.files.pickFeature();
    if (!file) return;
    const { feature, errors } = parseFeatureFile(file.text);
    if (!feature.title && !feature.list) {
      toast.error('That file has no feature in it');
      return;
    }
    if (feature.title) setTitle(feature.title);
    if (feature.version) setVersion(feature.version);
    if (feature.done) setDone(feature.done);
    if (feature.list) setList(feature.list);
    if (errors.length) toast.warning(errors.join(', '));
  }

  const parsed = useMemo(() => (list.trim() ? parseTestList(list) : null), [list]);
  const steps = parsed ? parsed.groups.reduce((sum, g) => sum + g.steps.length, 0) : 0;

  const losing = useMemo(() => {
    if (!editingId || !parsed || parsed.errors.length) return [];
    const editing = useTestStore.getState().features.find(f => f.id === editingId);
    if (!editing) return [];
    const kept = new Set(parsed.groups.flatMap(g => g.steps.map(s => `${g.letter}${s.num}`)));
    return editing.groups
      .flatMap(g => g.steps)
      .filter(s => !kept.has(s.code) && editing.results.some(r => r.stepId === s.id))
      .map(s => s.code);
  }, [editingId, parsed]);

  const why = !title.trim()
    ? 'Give the feature a name'
    : !version.trim()
      ? 'Pick the version it was done in'
      : !done.trim()
        ? 'Say what was done'
        : !parsed || parsed.groups.length === 0
          ? 'Write at least one test in What to test'
          : parsed.errors.length > 0
            ? 'Fix the errors under What to test'
            : null;
  const ready = why === null && !saving;

  async function submit() {
    if (!ready || !parsed) return;
    setSaving(true);
    try {
      await save(editingId, { title, version, done, groups: parsed.groups });
      toast.success(editingId ? 'Saved' : 'Feature added, testers can see it now');
      close();
    } catch (err) {
      toast.error(errorText(err));
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => !next && close()}>
      <DialogContent className="flex h-[85vh] max-h-[820px] flex-col gap-4 overflow-hidden sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Edit feature' : 'New feature'}</DialogTitle>
          <DialogDescription>Say what you did and what testers should try.</DialogDescription>
        </DialogHeader>

        {can.importTests && !editingId && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void importFile()}>
              <FileUp size={15} strokeWidth={1.6} />
              Import from file
            </Button>
            <span className="text-[12px] text-muted-foreground">Fills every box from a saved feature file</span>
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 pr-3">
            <div className="grid grid-cols-[1fr_170px] gap-3">
              <Field>
                <FieldLabel htmlFor="test-title">Name</FieldLabel>
                <MentionField
                  id="test-title"
                  value={title}
                  onValueChange={setTitle}
                  placeholder="Train doors"
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="test-version">Version</FieldLabel>
                <VersionSelect id="test-version" value={version} onChange={setVersion} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="test-done">What was done</FieldLabel>
              <MentionField multiline
                id="test-done"
                rows={4}
                value={done}
                onValueChange={setDone}
                placeholder="Doors now open when the train stops at a station."
              />
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="test-list">What to test</FieldLabel>
                <Button type="button" variant="ghost" size="xs" onClick={() => setList(EXAMPLE)}>
                  <FlaskConical size={12} strokeWidth={1.6} />
                  Fill with an example
                </Button>
              </div>
              <MentionField multiline
                id="test-list"
                rows={12}
                className="font-mono text-[12.5px]"
                value={list}
                onValueChange={setList}
                placeholder={EXAMPLE}
              />
              <FieldDescription>
                One group per letter. One step per line: A1, what to do, a bar, what should happen.
              </FieldDescription>
            </Field>

            {parsed && parsed.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Fix this first</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {parsed.errors.slice(0, 5).map(message => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {parsed && parsed.errors.length === 0 && (
              <div
                className="flex items-center gap-2 text-[13px]"
                style={{ color: 'var(--success)' }}
              >
                <CircleCheck size={15} strokeWidth={1.8} />
                {parsed.groups.length} {parsed.groups.length === 1 ? 'group' : 'groups'}, {steps}{' '}
                {steps === 1 ? 'step' : 'steps'}
              </div>
            )}

            {losing.length > 0 && (
              <Alert>
                <AlertTitle>These steps are gone from the list</AlertTitle>
                <AlertDescription>
                  {losing.join(', ')} have answers. Saving deletes them.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="items-center">
          <WhyDisabled reason={why} className="sm:mr-auto" />
          <Button variant="outline" disabled={saving} onClick={close}>
            Cancel
          </Button>
          <Button disabled={!ready} onClick={() => void submit()}>
            {editingId ? 'Save' : 'Add feature'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
