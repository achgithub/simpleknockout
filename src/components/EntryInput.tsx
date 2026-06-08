import { useState } from 'react';
import { Button } from './Button';

interface Props {
  entrySize: number;
  onCommit: (names: string[]) => void;
}

export function EntryInput({ entrySize, onCommit }: Props) {
  const [names, setNames] = useState<string[]>(Array(entrySize).fill(''));

  const update = (i: number, val: string) => {
    setNames((prev) => { const n = [...prev]; n[i] = val; return n; });
  };

  const ready = names.every((n) => n.trim().length > 0);

  const commit = () => {
    if (!ready) return;
    onCommit(names.map((n) => n.trim()));
    setNames(Array(entrySize).fill(''));
  };

  return (
    <div className="flex flex-col gap-2">
      {names.map((name, i) => (
        <input
          key={i}
          type="text"
          placeholder={entrySize === 1 ? 'Player name' : `Player ${i + 1} name`}
          value={name}
          onChange={(e) => update(i, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && i === entrySize - 1) commit(); }}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      ))}
      <Button onClick={commit} disabled={!ready}>
        {entrySize === 1 ? 'Add Player' : `Add ${entrySize === 2 ? 'Pair' : 'Triple'}`}
      </Button>
    </div>
  );
}
