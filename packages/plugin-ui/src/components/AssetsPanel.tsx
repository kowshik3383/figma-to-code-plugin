import React, { useState } from "react";
import {
  Download,
  Image as ImageIcon,
  FileCode,
  Check,
  CheckSquare,
  Square,
  Layers,
  Sparkles,
  Archive,
} from "lucide-react";
import { DetectedAsset } from "types";
import { Button } from "./ui/button";

interface AssetsPanelProps {
  assets: DetectedAsset[];
  onExportSingle?: (asset: DetectedAsset, scale: number) => void;
  onExportMultiple?: (
    items: Array<{
      nodeId: string;
      format: "PNG" | "SVG";
      scale: number;
      fileName: string;
    }>,
    zipName?: string,
  ) => void;
}

type ScaleOption = 1 | 2 | 3 | 4;
const SCALES: ScaleOption[] = [1, 2, 3, 4];

export const AssetsPanel: React.FC<AssetsPanelProps> = ({
  assets = [],
  onExportSingle,
  onExportMultiple,
}) => {
  const [filter, setFilter] = useState<"all" | "image" | "svg">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assetScales, setAssetScales] = useState<Record<string, ScaleOption>>({});
  const [globalScale, setGlobalScale] = useState<ScaleOption>(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingAssetId, setExportingAssetId] = useState<string | null>(null);

  const images = assets.filter((a) => a.type === "image");
  const svgs = assets.filter((a) => a.type === "svg");

  const filteredAssets = assets.filter((asset) => {
    if (filter === "image") return asset.type === "image";
    if (filter === "svg") return asset.type === "svg";
    return true;
  });

  const getAssetScale = (id: string): ScaleOption =>
    assetScales[id] ?? globalScale;

  const setAssetScale = (id: string, scale: ScaleOption) => {
    setAssetScales((prev) => ({ ...prev, [id]: scale }));
  };

  const handleApplyGlobalScale = (scale: ScaleOption) => {
    setGlobalScale(scale);
    const newScales: Record<string, ScaleOption> = {};
    for (const a of assets) {
      newScales[a.id] = scale;
    }
    setAssetScales(newScales);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredAssets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
    }
  };

  const formatFileName = (asset: DetectedAsset, scale: number) => {
    const cleanName = (asset.name || asset.type)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const ext = asset.format.toLowerCase();
    const suffix = asset.id.replace(/[^a-z0-9]/gi, "-");
    const scaleStr = scale > 1 && asset.format !== "SVG" ? `@${scale}x` : "";
    return `${cleanName}-${suffix}${scaleStr}.${ext}`;
  };

  const handleDownloadSingle = (asset: DetectedAsset) => {
    const scale = getAssetScale(asset.id);
    setExportingAssetId(asset.id);

    if (onExportSingle) {
      onExportSingle(asset, scale);
    } else {
      parent.postMessage(
        {
          pluginMessage: {
            type: "export-single-asset",
            nodeId: asset.id,
            format: asset.format,
            scale,
            fileName: formatFileName(asset, scale),
          },
        },
        "*",
      );
    }

    setTimeout(() => setExportingAssetId(null), 1200);
  };

  const handleDownloadSelected = () => {
    const targetAssets =
      selectedIds.size > 0
        ? filteredAssets.filter((a) => selectedIds.has(a.id))
        : filteredAssets;

    if (targetAssets.length === 0) return;

    setIsExporting(true);
    const items = targetAssets.map((asset) => {
      const scale = getAssetScale(asset.id);
      return {
        nodeId: asset.id,
        format: asset.format,
        scale,
        fileName: formatFileName(asset, scale),
      };
    });

    if (onExportMultiple) {
      onExportMultiple(items, "exported-assets.zip");
    } else {
      parent.postMessage(
        {
          pluginMessage: {
            type: "export-multiple-assets",
            items,
            zipFileName: "exported-assets.zip",
          },
        },
        "*",
      );
    }

    setTimeout(() => setIsExporting(false), 2000);
  };

  if (assets.length === 0) {
    return (
      <div className="w-full p-4 text-center rounded-xl border border-dashed border-border bg-card/40 text-muted-foreground text-xs">
        <Layers className="w-5 h-5 mx-auto mb-1.5 opacity-40 text-foreground" />
        <p className="font-semibold text-foreground">No Assets Detected</p>
        <p className="text-[11px] mt-0.5 text-muted-foreground">
          Select layers containing images or vector icons in Figma to export them.
        </p>
      </div>
    );
  }

  const allSelected =
    filteredAssets.length > 0 && selectedIds.size === filteredAssets.length;

  return (
    <div className="flex flex-col gap-2.5 w-full bg-card border border-border rounded-xl p-3.5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-foreground" />
          <span className="text-xs font-semibold text-foreground tracking-tight">
            Assets & Export ({assets.length})
          </span>
        </div>

        {/* Global Scale Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Scale:</span>
          <div className="flex bg-muted rounded-md p-0.5 gap-0.5 border border-border/60">
            {SCALES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleApplyGlobalScale(s)}
                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-all ${
                  globalScale === s
                    ? "bg-foreground text-background shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Bulk Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`text-xs px-2 py-0.5 rounded-md transition-all font-medium ${
              filter === "all"
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({assets.length})
          </button>
          {images.length > 0 && (
            <button
              type="button"
              onClick={() => setFilter("image")}
              className={`text-xs px-2 py-0.5 rounded-md transition-all font-medium ${
                filter === "image"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Images ({images.length})
            </button>
          )}
          {svgs.length > 0 && (
            <button
              type="button"
              onClick={() => setFilter("svg")}
              className={`text-xs px-2 py-0.5 rounded-md transition-all font-medium ${
                filter === "svg"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              SVGs ({svgs.length})
            </button>
          )}
        </div>

        {/* Download Selected / All Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadSelected}
          disabled={isExporting}
          className="h-7 text-xs gap-1.5 px-2.5 bg-muted/60 hover:bg-muted text-foreground border-border"
        >
          <Archive className="w-3.5 h-3.5" />
          <span>
            {selectedIds.size > 0
              ? `Export (${selectedIds.size})`
              : `Export All (${filteredAssets.length})`}
          </span>
        </Button>
      </div>

      {/* Select All Row */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
        <button
          type="button"
          onClick={selectAll}
          className="flex items-center gap-1.5 hover:text-foreground cursor-pointer select-none"
        >
          {allSelected ? (
            <CheckSquare className="w-3.5 h-3.5 text-foreground" />
          ) : (
            <Square className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span>Select all {filteredAssets.length}</span>
        </button>

        <span className="text-[10px]">PNG / SVG export</span>
      </div>

      {/* Asset List */}
      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-0.5">
        {filteredAssets.map((asset) => {
          const isSelected = selectedIds.has(asset.id);
          const currentScale = getAssetScale(asset.id);
          const isExportingThis = exportingAssetId === asset.id;

          return (
            <div
              key={asset.id}
              className={`flex items-center justify-between gap-2.5 p-2 rounded-lg border transition-all duration-150 ${
                isSelected
                  ? "bg-muted/80 border-foreground/30 shadow-2xs"
                  : "bg-muted/30 border-border hover:bg-muted/60"
              }`}
            >
              {/* Left: Checkbox + Thumbnail + Info */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => toggleSelect(asset.id)}
                  className="cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-foreground" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Thumbnail */}
                <div className="w-8 h-8 rounded-md bg-background border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                  {asset.type === "image" ? (
                    <ImageIcon className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <FileCode className="w-4 h-4 text-amber-500" />
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className="text-xs font-semibold text-foreground truncate"
                    title={asset.name}
                  >
                    {asset.name}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                    <span
                      className={`px-1 rounded font-semibold uppercase text-[9px] ${
                        asset.type === "image"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {asset.format}
                    </span>
                    {asset.width > 0 && asset.height > 0 && (
                      <span>
                        {asset.width} × {asset.height}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Scale Selector + Download Single Button */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Scale buttons for PNG */}
                {asset.format === "PNG" ? (
                  <div className="flex bg-background border border-border rounded-md p-0.5 gap-0.5">
                    {SCALES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setAssetScale(asset.id, s)}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-all ${
                          currentScale === s
                            ? "bg-foreground text-background shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground px-1 font-mono">
                    Vector
                  </span>
                )}

                {/* Download Single Button */}
                <button
                  type="button"
                  onClick={() => handleDownloadSingle(asset)}
                  disabled={isExportingThis}
                  className="p-1.5 rounded-md bg-muted hover:bg-accent text-foreground border border-border transition-colors cursor-pointer shadow-2xs"
                  title={`Download ${asset.name}`}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssetsPanel;
