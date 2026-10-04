import { Fragment } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemGroup, ItemSeparator } from '@/components/ui/item';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_NOTIFY_PREFS, KIND_META } from '@/lib/notifications';
import { errorText } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { NOTIFICATION_KINDS, type NotificationKind, type NotifyPrefs } from '@/types';
import SettingRow from './SettingRow';

export default function NotificationsCard() {
  const prefs = useAuthStore(s => s.profile?.notifyPrefs ?? DEFAULT_NOTIFY_PREFS);
  const updateProfile = useAuthStore(s => s.updateProfile);

  function save(next: NotifyPrefs) {
    void updateProfile({ notifyPrefs: next }).catch(err => toast.error(errorText(err)));
  }

  function setKind(kind: NotificationKind, on: boolean) {
    save({ ...prefs, kinds: { ...prefs.kinds, [kind]: on } });
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-[13px]">Notifications</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ItemGroup>
          <SettingRow
            title="Desktop pop ups"
            description="Show a pop up over the desktop when something arrives while the window is in the background"
            htmlFor="notify-desktop"
          >
            <Switch
              id="notify-desktop"
              checked={prefs.desktop}
              onCheckedChange={desktop => save({ ...prefs, desktop })}
            />
          </SettingRow>

          {NOTIFICATION_KINDS.map(kind => (
            <Fragment key={kind}>
              <ItemSeparator />
              <SettingRow title={KIND_META[kind].label} description={KIND_META[kind].hint} htmlFor={`notify-${kind}`}>
                <Switch
                  id={`notify-${kind}`}
                  checked={prefs.kinds[kind] !== false}
                  onCheckedChange={on => setKind(kind, on)}
                />
              </SettingRow>
            </Fragment>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
