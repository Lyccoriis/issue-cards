import { Circle, Square } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemGroup, ItemSeparator } from '@/components/ui/item';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useLayoutStore } from '@/stores/useLayoutStore';
import SettingRow from './SettingRow';

export default function IdentityCard() {
  const prefs = useLayoutStore(s => s.identity);
  const setIdentity = useLayoutStore(s => s.setIdentity);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-[13px]">Faces and names</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ItemGroup>
          <SettingRow
            title="Clicking a face"
            description="Every place a person is drawn, from a note author to the filter row"
          >
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={prefs.click}
              onValueChange={value => value && setIdentity({ click: value as 'profile' | 'action' })}
            >
              <ToggleGroupItem value="profile" aria-label="open the profile" className="text-[12px]">
                Opens them
              </ToggleGroupItem>
              <ToggleGroupItem value="action" aria-label="do what the spot does" className="text-[12px]">
                Filters the list
              </ToggleGroupItem>
            </ToggleGroup>
          </SettingRow>

          <ItemSeparator />
          <SettingRow
            title="Right click menu"
            description="Their profile, their cards, and their name or email on the clipboard"
            htmlFor="identity-menu"
          >
            <Switch
              id="identity-menu"
              checked={prefs.menu}
              onCheckedChange={menu => setIdentity({ menu })}
            />
          </SettingRow>

          <ItemSeparator />
          <SettingRow
            title="Underline a name on hover"
            description="Marks the name as a person rather than as plain text"
            htmlFor="identity-underline"
          >
            <Switch
              id="identity-underline"
              checked={prefs.underline}
              onCheckedChange={underline => setIdentity({ underline })}
            />
          </SettingRow>

          <ItemSeparator />
          <SettingRow title="Face shape" description="How a picture is cut, everywhere at once">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={prefs.shape}
              onValueChange={value => value && setIdentity({ shape: value as 'circle' | 'square' })}
            >
              <ToggleGroupItem value="circle" aria-label="round faces" className="gap-1.5 text-[12px]">
                <Circle size={15} strokeWidth={1.6} />
                Round
              </ToggleGroupItem>
              <ToggleGroupItem value="square" aria-label="square faces" className="gap-1.5 text-[12px]">
                <Square size={15} strokeWidth={1.6} />
                Rounded
              </ToggleGroupItem>
            </ToggleGroup>
          </SettingRow>
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
