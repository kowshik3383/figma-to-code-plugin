import React, { useState, useEffect, useRef } from "react";
import { Folder, FolderOpen, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface CustomImagePathInputProps {
  initialValue?: string;
  onValueChange: (value: string) => void;
}

const PRESET_PATHS = [
  { label: "images/", path: "images/" },
  { label: "assets/", path: "assets/" },
  { label: "public/images/", path: "public/images/" },
  { label: "src/assets/", path: "src/assets/" },
];

export const CustomImagePathInput: React.FC<CustomImagePathInputProps> = ({
  initialValue = "images/",
  onValueChange,
}) => {
  const [value, setValue] = useState(initialValue);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue || "images/");
  }, [initialValue]);

  const updatePath = (val: string) => {
    let cleanVal = val.trim();
    if (cleanVal && !cleanVal.endsWith("/") && !cleanVal.includes(".")) {
      cleanVal += "/";
    }
    setValue(cleanVal);
    onValueChange(cleanVal);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    onValueChange(val);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
  };

  const handleBrowseFolder = async () => {
    try {
      // 1. Try modern File System Access API (Chromium / Electron / Figma Desktop)
      if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: "readwrite",
        });
        if (dirHandle && dirHandle.name) {
          const folderName = `${dirHandle.name}/`;
          updatePath(folderName);
          return;
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return; // User cancelled directory selection dialog
      }
    }

    // 2. Fallback to native folder input
    fileInputRef.current?.click();
  };

  const handleFolderInputFallback = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const relativePath = (firstFile as any).webkitRelativePath;
      if (relativePath) {
        const rootFolder = relativePath.split("/")[0];
        if (rootFolder) {
          updatePath(`${rootFolder}/`);
        }
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full mt-1">
      {/* Hidden file input for webkitdirectory fallback */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFolderInputFallback}
        // @ts-expect-error webkitdirectory is standard for folder picker
        webkitdirectory="true"
        directory="true"
        multiple
        tabIndex={-1}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <label
          htmlFor="custom-image-path-input"
          className="text-xs font-semibold text-foreground flex items-center gap-1.5"
        >
          <Folder className="w-3.5 h-3.5 text-muted-foreground" />
          Image & Asset Path
        </label>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="text-[10px] text-muted-foreground cursor-help underline decoration-dotted">
                Info
              </span>
            }
          />
          <TooltipContent className="text-xs max-w-xs">
            Path prefix used in generated &lt;img src=&quot;...&quot;&gt; tags
            and project export (e.g., &quot;images/&quot;, &quot;assets/&quot;).
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Input row with Browse Folder Button */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 flex items-center">
          <input
            id="custom-image-path-input"
            type="text"
            value={value}
            onChange={handleChange}
            placeholder="images/"
            className="w-full pl-2.5 pr-7 py-1.5 text-xs bg-background border border-border text-foreground rounded-lg focus:outline-hidden focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10 shadow-2xs font-mono"
          />
          {showSuccess && (
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 absolute right-2.5" />
          )}
        </div>

        <button
          type="button"
          onClick={handleBrowseFolder}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-muted hover:bg-accent text-foreground border border-border rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs active:scale-95"
          title="Open folder picker"
        >
          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Browse</span>
        </button>
      </div>

      {/* Quick Presets */}
      <div className="flex items-center gap-1 flex-wrap pt-0.5">
        <span className="text-[10px] text-muted-foreground mr-0.5">Quick:</span>
        {PRESET_PATHS.map((preset) => {
          const isSelected = value === preset.path;
          return (
            <button
              key={preset.path}
              type="button"
              onClick={() => updatePath(preset.path)}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                isSelected
                  ? "bg-foreground text-background border-foreground font-semibold shadow-2xs"
                  : "bg-muted/50 border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CustomImagePathInput;
