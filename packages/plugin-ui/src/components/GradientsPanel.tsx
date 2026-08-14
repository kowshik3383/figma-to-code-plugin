import React from "react";
import { useState } from "react";
import { Sparkles, Check } from "lucide-react";

const GradientsPanel = (props: {
  gradients: {
    cssPreview: string;
    exportValue: string;
  }[];
  onColorClick: (color: string) => void;
}) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleButtonClick = (value: string, idx: number) => {
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1200);
    props.onColorClick(value);
  };

  return (
    <div className="bg-card border border-border w-full rounded-xl p-3.5 flex flex-col gap-2.5 shadow-xs">
      <div className="flex items-center justify-between pb-1 border-b border-border">
        <h3 className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-foreground" />
          Gradients
        </h3>
        <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground border border-border/60">
          {props.gradients.length} gradient{props.gradients.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {props.gradients.map((gradient, idx) => {
          const isCopied = copiedIdx === idx;
          return (
            <button
              key={"gradient-" + idx}
              type="button"
              className={`w-full h-15 rounded-lg text-xs font-semibold shadow-2xs transition-all duration-150 relative overflow-hidden border border-black/10 dark:border-white/15 cursor-pointer active:scale-95 flex items-center justify-center ${
                isCopied ? "ring-2 ring-foreground" : "hover:shadow-xs"
              }`}
              style={{ background: gradient.cssPreview }}
              aria-label={`Copy gradient ${idx + 1}: ${gradient.exportValue}`}
              title={`Gradient ${idx + 1} (${gradient.exportValue}) - Click to copy`}
              onClick={() => {
                handleButtonClick(gradient.exportValue, idx);
              }}
            >
              {isCopied && (
                <div className="bg-black/60 backdrop-blur-xs text-white px-2 py-1 rounded-md flex items-center gap-1 text-[11px] font-bold shadow-xs">
                  <Check size={12} className="stroke-[3]" />
                  <span>Copied</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default GradientsPanel;
