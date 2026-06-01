import type {MemoryItem} from "@/lib/constants/mock-data";
import {MemoryCard} from "@/components/memory/memory-card";

export function MemoryGrid({items}: {items: MemoryItem[]}) {
  return (
    <section className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((memory) => (
        <MemoryCard key={memory.slug} memory={memory} />
      ))}
    </section>
  );
}
