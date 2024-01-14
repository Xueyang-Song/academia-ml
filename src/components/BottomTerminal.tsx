import { useEffect, useRef } from "react";

export default function BottomTerminal({ lines }: { lines: string[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  return (
    <div className="h-full w-full overflow-y-auto border border-line bg-paper px-2 py-1.5 font-mono text-[12px] leading-5 text-ink">
      {lines.length === 0 ? (
        <div className="text-slate">No log output yet.</div>
      ) : (
        lines.map((line, index) => (
          <div key={`${index}-${line.slice(0, 20)}`} className="whitespace-pre-wrap break-words">
            {line}
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}
