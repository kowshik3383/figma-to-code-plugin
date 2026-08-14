import { useState } from "react";
import { SolidColorConversion } from "types";
import { Palette, Check } from "lucide-react";

const ColorsPanel = (props: {
  colors: SolidColorConversion[];
  onColorClick: (color: string) => void;
}) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleButtonClick = (value: string, idx: number) => {
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1200);
    props.onColorClick(value);
  };

  // Helper function to format complex color values
  const formatColorValue = (value: string) => {
    if (value.includes("var(--")) {
      const varMatch = value.match(/var\(--([\w-]+)/);
      return varMatch ? `--${varMatch[1]}` : value;
    }
    return value;
  };

  const getValidHex = (hex: string) => {
    if (!hex) return "#000000";
    return hex.startsWith("#") ? hex : `#${hex}`;
  };

  return (
    <div className="bg-card border border-border w-full rounded-xl p-3.5 flex flex-col gap-2.5 shadow-xs">
      <div className="flex items-center justify-between pb-1 border-b border-border">
        <h3 className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-foreground" />
          Color Palette
        </h3>
        <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground border border-border/60">
          {props.colors.length} color{props.colors.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {props.colors.map((color, idx) => {
          const bgHex = getValidHex(color.hex);
          const isCopied = copiedIdx === idx;
          const isLight = color.contrastBlack > color.contrastWhite;
          const textColor = isLight ? "#1b1b1b" : "#ffffff";

          return (
            <button
              key={"color-" + idx}
              type="button"
              className={`w-full h-15 rounded-lg text-xs font-semibold shadow-2xs transition-all duration-150 relative overflow-hidden border border-black/10 dark:border-white/15 cursor-pointer active:scale-95 flex flex-col items-center justify-center p-1.5 ${
                isCopied ? "ring-2 ring-foreground" : "hover:shadow-xs"
              }`}
              style={{ backgroundColor: bgHex }}
              onClick={() => handleButtonClick(color.exportValue, idx)}
              title={`${color.colorName || bgHex} (${color.exportValue}) - Click to copy`}
            >
              {isCopied ? (
                <div
                  className="flex items-center gap-1 text-[11px] font-bold"
                  style={{ color: textColor }}
                >
                  <Check size={13} className="stroke-[3]" />
                  <span>Copied</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center w-full px-1">
                  <span
                    className="text-[11px] font-bold tracking-tight truncate max-w-full"
                    style={{ color: textColor }}
                  >
                    {color.colorName ? color.colorName : bgHex}
                  </span>
                  {color.exportValue !== bgHex && (
                    <span
                      className="text-[9px] opacity-80 truncate max-w-full font-mono"
                      style={{ color: textColor }}
                    >
                      {formatColorValue(color.exportValue)}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ColorsPanel;
