# Issue Cards

A desktop app for keeping track of bugs and features with other people. Everyone has their
own account, cards live in a shared workspace, and it all sits in Supabase so everyone sees
the same list.

It's an Electron app with a React UI. Besides the cards there is a testing board, a
leaderboard and notifications.

## Running it

Run `dev.bat`, or `npm install` and then `npm run dev`. The first launch shows a sign in
screen, make an account and you're in.

The project it connects to is set in `src/lib/connectionDefaults.ts`. The URL and the anon
key there are meant to be public, the data is protected by row level security.

## Sharing a workspace

Settings, Workspace has an invite code. Send it to someone, they paste it under Join with a
code, and from then on you both see the same cards, tags and notes. Only members can read
or write a workspace. If the invite code leaks, the owner can make a new one from the same
place.

## Card states

- `open` and `fixed` are the normal ones.
- `fixed` needs a test procedure, so the person checking knows how.
- `resolved` and `wontfix` are only set by someone confirming it in the app.
- A fixed card goes back to open when someone rejects it with a reason.

## Using your own Supabase project

Settings, Connection takes a different URL and anon key, stored on that machine only. You
can also set them in `.env`, see `.env.example`. A new project needs the schema first:

```
npx supabase link --project-ref <ref>
npx supabase db push
```

## Attachments

Drop a file on a card, paste a screenshot, or paste a link. Only the link is stored in
Supabase, the file goes to a host.

- Files go to catbox.moe, up to 200 MB. If you set an Imgur Client-ID in Settings,
  Connection, images go to Imgur instead.
- YouTube links stay links and play in the card.
- Discord links expire after a day, so they get copied to catbox when you add them.
- Images and video show in the card, anything else is a download link.

Anyone with an attachment link can open it, so don't attach anything private.

## Releasing

The installed app checks this repo's GitHub releases for a newer version and updates
itself. `npm run build` makes the installer in `release/`, and the files in there are what
goes on a release.

## Folders

```
electron/             window, uploads, auto updater
src/lib/              supabase client and data code
src/stores/           app state
src/panels/           the screens
supabase/migrations/  the database schema
```
