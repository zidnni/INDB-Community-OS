import {MemoryCard} from "@/components/memory/memory-card";
import type {MemoryWithContributor} from "@/types/database";

export function MemoryGrid({items}: {items: MemoryWithContributor[]}) {
  return (
    <section className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((memory) => (
        <MemoryCard key={memory.id} memory={memory} />
      ))}
    </section>
  );
}
