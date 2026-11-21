import React from "react";
import { HTMLPreview } from "types";
import { Maximize2, Minimize2, MonitorSmartphone, Circle } from "lucide-react";
import { cn, replaceExternalImagesWithCanvas } from "../lib/utils";
import { Button } from "./ui/button";

// Update the component props to receive state from parent
const Preview: React.FC<{
  htmlPreview: HTMLPreview;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode: "desktop" | "mobile" | "precision";
  setViewMode: React.Dispatch<
    React.SetStateAction<"desktop" | "mobile" | "precision">
  >;
  bgColor: "white" | "black";
  setBgColor: React.Dispatch<React.SetStateAction<"white" | "black">>;
}> = (props) => {
  const {
    htmlPreview,
    expanded,
    setExpanded,
    viewMode,
    setViewMode,
    bgColor,
    setBgColor,
  } = props;

  // Define consistent dimensions regardless of mode
  const containerWidth = expanded ? 320 : 240;
  const containerHeight = expanded ? 180 : 120;

  // Calculate scale factor first to use in content width calculation
  const viewportWidth =
    viewMode === "mobile"
      ? 375
      : viewMode === "desktop"
        ? 1280
        : Math.max(1, htmlPreview.size.width);
  const viewportHeight = Math.max(1, htmlPreview.size.height);
  const scaleFactor = Math.min(
    1,
    containerWidth / viewportWidth,
    containerHeight / viewportHeight,
  );

  return (
    <div className="flex flex-col w-full bg-card rounded-xl border border-border shadow-xs overflow-hidden">
      {/* Header with view mode controls */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-border bg-card/50">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <MonitorSmartphone size={14} className="text-muted-foreground" />
          Preview
        </h3>
        <div className="flex items-center gap-1">
          <select
            aria-label="Preview viewport"
            value={viewMode}
            onChange={(event) =>
              setViewMode(event.currentTarget.value as typeof viewMode)
            }
            className="rounded border border-border bg-card text-xs"
          >
            <option value="precision">Design width</option>
            <option value="mobile">Mobile (375 px)</option>
            <option value="desktop">Desktop (1280 px)</option>
          </select>
          {/* Background Color Toggle */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setBgColor(bgColor === "white" ? "black" : "white")}
            className="rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label={`Switch preview to ${bgColor === "white" ? "black" : "white"} background`}
            title={`Switch preview to ${bgColor === "white" ? "black" : "white"} background`}
          >
            <Circle
              size={13}
              fill={bgColor === "white" ? "#ffffff" : "#1b1b1b"}
              className="stroke-foreground/40"
            />
          </Button>

          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setExpanded(!expanded)}
            className="rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label={expanded ? "Minimize preview" : "Maximize preview"}
            title={expanded ? "Minimize preview" : "Maximize preview"}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </Button>
        </div>
      </div>

      {/* Preview container */}
      <div className="flex justify-center items-center bg-muted/40 p-3">
        {/* Outer container with fixed dimensions */}
        <div
          className="relative"
          style={{
            width: containerWidth,
            height: containerHeight,
            transition: "width 0.3s ease, height 0.3s ease",
          }}
        >
          {/* Inner content positioned based on view mode */}
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              width: viewportWidth * scaleFactor,
              height: viewportHeight * scaleFactor,
              transition: "width 0.3s ease, height 0.3s ease",
            }}
          >
            {/* Device frame */}
            <div
              className={cn(
                "w-full h-full flex justify-center items-center overflow-hidden rounded-md border border-border shadow-xs",
                bgColor === "white" ? "bg-white" : "bg-[#141414]",
                "transition-all duration-200 ease-in-out",
              )}
            >
              {/* Content */}
              <div className="w-full h-full flex justify-center items-center">
                <iframe
                  title="Generated design preview"
                  sandbox=""
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: viewportWidth,
                    height: viewportHeight,
                    transform: `scale(${scaleFactor})`,
                    transformOrigin: "top left",
                    border: 0,
                  }}
                  srcDoc={
                    htmlPreview.fullDocument
                      ? htmlPreview.content.replace(
                          "<head>",
                          `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'${htmlPreview.allowRemoteFonts ? " https://fonts.googleapis.com; font-src https://fonts.gstatic.com" : ""}">`,
                        )
                      : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>body{margin:0}</style></head><body>${replaceExternalImagesWithCanvas(htmlPreview.content)}</body></html>`
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with size info */}
      <div className="px-3 py-1.5 text-[11px] font-mono text-muted-foreground flex items-center justify-between border-t border-border bg-card/30">
        <span>
          {Math.round(viewportWidth)} × {Math.round(viewportHeight)} px
        </span>
        <span className="text-[10px] text-muted-foreground/70">
          Scale {(scaleFactor * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

export default Preview;
