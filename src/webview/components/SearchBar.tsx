import { useEffect, useState } from "react";

type Props = {
  onSearch: (q: string) => void;
};

export function SearchBar({ onSearch }: Props) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      onSearch(value.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [value, onSearch]);

  return (
    <input
      type="search"
      placeholder="検索..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full bg-[var(--bg-sunk)] border border-[var(--border-soft)] rounded px-2 py-1 text-xs text-[var(--text-bright)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
    />
  );
}
