import { Download, RefreshCw, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemGroup, ItemSeparator } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { useUpdateStore } from '@/stores/useUpdateStore';
import SettingRow from './SettingRow';

export default function UpdateCard() {
  const state = useUpdateStore(s => s.state);
  const check = useUpdateStore(s => s.check);
  const download = useUpdateStore(s => s.download);
  const install = useUpdateStore(s => s.install);

  const busy = state.stage === 'checking' || state.stage === 'downloading';

  let status: string;
  if (!state.supported) status = 'Auto update runs in the installed build, not here';
  else if (state.stage === 'checking') status = 'Looking for a newer build';
  else if (state.stage === 'available') status = `Version ${state.version} is ready to download`;
  else if (state.stage === 'downloading') status = `Downloading ${state.version}`;
  else if (state.stage === 'ready') status = `Version ${state.version} is downloaded, restart to use it`;
  else if (state.stage === 'error') status = state.message || 'Could not reach the update feed';
  else if (state.stage === 'none') status = 'This is the latest version';
  else status = 'Checked against the latest release';

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-[13px]">Updates</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ItemGroup>
          <SettingRow title={`Version ${state.currentVersion}`} description={status}>
            {state.stage === 'ready' ? (
              <Button size="sm" onClick={install}>
                <RotateCw size={15} strokeWidth={1.6} />
                Restart and install
              </Button>
            ) : state.stage === 'available' ? (
              <Button size="sm" onClick={() => void download()}>
                <Download size={15} strokeWidth={1.6} />
                Download {state.version}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !state.supported}
                onClick={() => void check(true)}
              >
                <RefreshCw size={15} strokeWidth={1.6} className={busy ? 'animate-spin' : undefined} />
                {state.stage === 'checking' ? 'Checking' : 'Check for updates'}
              </Button>
            )}
          </SettingRow>

          {state.stage === 'downloading' && (
            <>
              <ItemSeparator />
              <SettingRow title="Progress" description={`${state.percent}% of the installer`}>
                <Progress value={state.percent} className="w-[280px]" />
              </SettingRow>
            </>
          )}

          {state.notes && (state.stage === 'available' || state.stage === 'ready') && (
            <>
              <ItemSeparator />
              <SettingRow title="What changed" description={state.notes}>
                <span />
              </SettingRow>
            </>
          )}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
