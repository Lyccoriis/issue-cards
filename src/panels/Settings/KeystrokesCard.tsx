import { useEffect, useState } from 'react';
import { ChevronRight, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ItemGroup, ItemSeparator } from '@/components/ui/item';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { APP_COMMANDS, resolveBindings } from '@/lib/commands';
import { bindingFromEvent, formatBinding, isUsableBinding, setCapturing } from '@/lib/keys';
import { useAuthStore } from '@/stores/useAuthStore';
import SettingRow from './SettingRow';

export default function KeystrokesCard() {
  const keys = useAuthStore(s => s.profile?.keys);
  const updateProfile = useAuthStore(s => s.updateProfile);
  const [recording, setRecording] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const bindings = resolveBindings(keys);
  const bound = APP_COMMANDS.filter(command => bindings[command.id]).length;

  function write(next: Record<string, string>) {
    void updateProfile({ keys: next });
  }

  function assign(commandId: string, binding: string) {
    const next = { ...(keys ?? {}) };

    for (const command of APP_COMMANDS) {
      if (command.id !== commandId && bindings[command.id] === binding) {
        next[command.id] = '';
        toast.info(`${command.label} lost its keystroke`);
      }
    }

    next[commandId] = binding;
    write(next);
  }

  useEffect(() => {
    if (!recording) return;
    const target = recording;
    setCapturing(true);

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecording(null);
        return;
      }

      const binding = bindingFromEvent(e);
      if (!binding) return;

      if (!isUsableBinding(binding)) {
        toast.error('A keystroke needs Ctrl, Alt or Cmd, or a function key');
        return;
      }

      assign(target, binding);
      setRecording(null);
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      setCapturing(false);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  });

  function clear(commandId: string) {
    write({ ...(keys ?? {}), [commandId]: '' });
  }

  function resetAll() {
    write({});
    toast.success('Keystrokes back to defaults');
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className={`py-4 ${open ? 'border-b' : ''}`}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex items-center gap-2 rounded-sm text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ChevronRight
                size={15}
                strokeWidth={1.6}
                className={`text-muted-foreground transition-transform duration-150 group-hover:text-foreground ${open ? 'rotate-90' : ''}`}
              />
              <CardTitle className="text-[13px]">Keystrokes</CardTitle>
              <span className="text-[12px] text-muted-foreground">
                {bound} of {APP_COMMANDS.length} bound
              </span>
            </button>
          </CollapsibleTrigger>
          {open && (
            <CardAction>
              <Button variant="outline" size="sm" onClick={resetAll}>
                <RotateCcw size={15} strokeWidth={1.6} />
                Reset keystrokes
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="px-0">
            <ItemGroup>
              {APP_COMMANDS.map((command, index) => (
                <div key={command.id}>
                  {index > 0 && <ItemSeparator />}
                  <SettingRow title={command.label} description={command.hint}>
                    <Recorder
                      binding={bindings[command.id]}
                      recording={recording === command.id}
                      onStart={() => setRecording(command.id)}
                      onClear={() => clear(command.id)}
                    />
                  </SettingRow>
                </div>
              ))}
            </ItemGroup>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface RecorderProps {
  binding: string;
  recording: boolean;
  onStart: () => void;
  onClear: () => void;
}

function Recorder({ binding, recording, onStart, onClear }: RecorderProps) {
  const keys = formatBinding(binding);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={onStart}
        aria-pressed={recording}
        className={`min-w-[140px] justify-center ${recording ? 'border-primary ring-[3px] ring-ring/30' : ''}`}
      >
        {recording ? (
          <span className="text-muted-foreground">Press keys, Esc to cancel</span>
        ) : keys.length ? (
          <KbdGroup>
            {keys.map(key => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
        ) : (
          <span className="text-muted-foreground">Not bound</span>
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        disabled={!binding}
        aria-label="Clear keystroke"
      >
        <X size={15} strokeWidth={1.6} />
      </Button>
    </>
  );
}
