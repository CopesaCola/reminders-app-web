'use client';

import { CommandPalette } from './CommandPalette';
import { PushBootstrap } from './PushBootstrap';

export function GlobalChrome() {
  return (
    <>
      <PushBootstrap />
      <CommandPalette />
    </>
  );
}
