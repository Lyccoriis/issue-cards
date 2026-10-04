import { useEffect, useMemo } from 'react';

import { APP_COMMANDS, resolveBindings } from '@/lib/commands';
import { bindingFromEvent, isCapturing } from '@/lib/keys';
import { useAuthStore } from '@/stores/useAuthStore';

export function useKeybindings(): void {
  const overrides = useAuthStore(s => s.profile?.keys);
  const bindings = useMemo(() => resolveBindings(overrides), [overrides]);

  useEffect(() => {
    const byBinding = new Map<string, () => void>();
    for (const command of APP_COMMANDS) {
      const binding = bindings[command.id];
      if (binding) byBinding.set(binding, command.run);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isCapturing()) return;
      const binding = bindingFromEvent(e);
      if (!binding) return;
      const run = byBinding.get(binding);
      if (!run) return;
      e.preventDefault();
      run();
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [bindings]);
}
