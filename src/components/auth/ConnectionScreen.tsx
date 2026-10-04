import { useState } from 'react';
import { Plug } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { connection, saveConnection } from '@/lib/supabase';

export default function ConnectionScreen({ onSaved }: { onSaved: () => void }) {
  const current = connection();
  const [url, setUrl] = useState(current.url);
  const [anonKey, setAnonKey] = useState(current.anonKey);

  function save() {
    if (!/^https?:\/\//.test(url.trim())) {
      toast.error('The project URL starts with https://');
      return;
    }
    if (!anonKey.trim()) {
      toast.error('The anon key is missing');
      return;
    }
    saveConnection({ url: url.trim(), anonKey: anonKey.trim() });
    onSaved();
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Plug size={17} strokeWidth={1.6} />
          </div>
          <CardTitle>Connect the project</CardTitle>
          <CardDescription>
            Paste the Supabase project URL and anon key. Both are in the project settings under API.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="conn-url">Project URL</Label>
            <Input
              id="conn-url"
              value={url}
              placeholder="https://abcdefgh.supabase.co"
              onChange={e => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="conn-key">Anon key</Label>
            <Input id="conn-key" value={anonKey} onChange={e => setAnonKey(e.target.value)} />
          </div>

          <Button className="w-full" onClick={save}>Connect</Button>
        </CardContent>
      </Card>
    </div>
  );
}
