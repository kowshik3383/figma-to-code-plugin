import copy from "copy-to-clipboard";
import PrototypePanel from "./components/PrototypePanel";
import Preview from "./components/Preview";
import GradientsPanel from "./components/GradientsPanel";
import ColorsPanel from "./components/ColorsPanel";
import CodePanel from "./components/CodePanel";
import EmptyState from "./components/EmptyState";
import About from "./components/About";
import WarningsPanel from "./components/WarningsPanel";
import AssetsPanel from "./components/AssetsPanel";
import {
  Framework,
  DownloadFormat,
  HTMLPreview,
  LinearGradientConversion,
  PluginSettings,
  SolidColorConversion,
  Warning,
  DetectedAsset,
  CompilationMetrics,
} from "types";
import {
  preferenceOptions,
  selectPreferenceOptions,
} from "./codegenPreferenceOptions";
import Loading from "./components/Loading";
import { useEffect, useState } from "react";
import { Box, Code2, InfoIcon, Layers3, MousePointer2 } from "lucide-react";
import React from "react";
import { ScrollArea } from "./components/ui/scroll-area";
import { TooltipProvider } from "./components/ui/tooltip";

type PluginUIProps = {
  code: string;
  documentCss?: string;
  htmlPreview: HTMLPreview;
  warnings: Warning[];
  selectedFramework: Framework;
  setSelectedFramework: (framework: Framework) => void;
  settings: PluginSettings | null;
  onPreferenceChanged: (
    key: keyof PluginSettings,
    value: PluginSettings[keyof PluginSettings],
  ) => void;
  colors: SolidColorConversion[];
  gradients: LinearGradientConversion[];
  assets?: DetectedAsset[];
  metrics?: CompilationMetrics;
  isLoading: boolean;
  onDownloadProject?: (format: DownloadFormat) => void;
  isDownloadingProject?: boolean;
  projectDownloadError?: string | null;
  assetExportError?: string | null;
};

const frameworks: Framework[] = ["HTML", "Tailwind"];
const LOADING_INDICATOR_DELAY_MS = 250;

const DelayedLoading = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setVisible(true),
      LOADING_INDICATOR_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  return visible ? <Loading /> : null;
};

type FrameworkTabsProps = {
  frameworks: Framework[];
  selectedFramework: Framework;
  setSelectedFramework: (framework: Framework) => void;
  showAbout: boolean;
  setShowAbout: (show: boolean) => void;
};

const FrameworkTabs = ({
  frameworks,
  selectedFramework,
  setSelectedFramework,
  showAbout,
  setShowAbout,
}: FrameworkTabsProps) => {
  return (
    <div className="grid grid-cols-2 gap-1 grow">
      {frameworks.map((tab) => {
        const isSelected = selectedFramework === tab && !showAbout;
        return (
          <button
            key={`tab ${tab}`}
            type="button"
            aria-pressed={isSelected}
            className={`w-full h-7.5 px-3 rounded-md text-xs font-semibold tracking-tight transition-all duration-150 flex items-center justify-center select-none ${
              isSelected
                ? "bg-foreground text-background shadow-xs ring-1 ring-foreground/10"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60 dark:hover:bg-muted/60"
            }`}
            onClick={() => {
              setSelectedFramework(tab as Framework);
              setShowAbout(false);
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
};

export const PluginUI = (props: PluginUIProps) => {
  const [showAbout, setShowAbout] = useState(false);
  const [section, setSection] = useState<"export" | "prototype" | "assets">(
    "export",
  );

  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewViewMode, setPreviewViewMode] = useState<
    "desktop" | "mobile" | "precision"
  >("precision");
  const [previewBgColor, setPreviewBgColor] = useState<"white" | "black">(
    "white",
  );

  const isEmpty = props.code === "";
  const warnings = props.warnings ?? [];
  const preview = props.htmlPreview.useCode
    ? { ...props.htmlPreview, content: props.code }
    : props.htmlPreview;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-hidden bg-background text-foreground selection:bg-neutral-200 dark:selection:bg-neutral-800">
        <header className="shrink-0 border-b border-border bg-card px-3 pt-3">
          <div className="flex items-center gap-2.5 pb-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-white">
              <Box size={17} />
            </span>
            <h1 className="grow text-sm font-semibold tracking-tight">
              Figma to Code
            </h1>
            <button
              type="button"
              aria-label="About Figma to Code"
              aria-pressed={showAbout}
              className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setShowAbout(!showAbout)}
            >
              <InfoIcon size={16} />
            </button>
          </div>
          <nav className="grid grid-cols-3 gap-2" aria-label="Plugin workspace">
            {(
              [
                ["export", "Export", Code2],
                ["prototype", "Prototype", MousePointer2],
                ["assets", "Assets", Layers3],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-pressed={!showAbout && section === id}
                className={`flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-1 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring ${!showAbout && section === id ? "border-blue-600 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"}`}
                onClick={() => {
                  setShowAbout(false);
                  setSection(id);
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>
        </header>

        {/* Content Scroll Area */}
        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          <div hidden={showAbout || section !== "prototype"} className="p-3">
            <PrototypePanel
              active={!props.isLoading && !showAbout && section === "prototype"}
              html={preview.fullDocument ? preview.content : undefined}
              onEnable={() => {
                props.onPreferenceChanged("outputFormat", "single-html");
                props.onPreferenceChanged("embedDocumentImages", true);
              }}
            />
          </div>
          {props.isLoading ? (
            <DelayedLoading />
          ) : showAbout ? (
            <About
              useOldPluginVersion={props.settings?.useOldPluginVersion2025}
              onPreferenceChanged={props.onPreferenceChanged}
            />
          ) : section === "prototype" ? null : section === "assets" ? (
            <div className="grid gap-3 p-3">
              {props.assets?.length ? (
                <AssetsPanel assets={props.assets} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a frame with image or vector assets.
                </p>
              )}
              {props.assetExportError && (
                <p role="alert" className="text-xs text-destructive">
                  {props.assetExportError}
                </p>
              )}
              {props.colors.length > 0 && (
                <ColorsPanel
                  colors={props.colors}
                  onColorClick={(value) => copy(value)}
                />
              )}
              {props.gradients.length > 0 && (
                <GradientsPanel
                  gradients={props.gradients}
                  onColorClick={(value) => copy(value)}
                />
              )}
            </div>
          ) : isEmpty ? (
            <div className="flex min-h-full items-center justify-center p-4">
              <EmptyState />
            </div>
          ) : (
            <div className="flex flex-col items-center px-3.5 pt-3 pb-4 gap-3 w-full max-w-full">
              {preview.content && (
                <Preview
                  htmlPreview={preview}
                  expanded={previewExpanded}
                  setExpanded={setPreviewExpanded}
                  viewMode={previewViewMode}
                  setViewMode={setPreviewViewMode}
                  bgColor={previewBgColor}
                  setBgColor={setPreviewBgColor}
                />
              )}

              {warnings.length > 0 && <WarningsPanel warnings={warnings} />}

              {(props.settings?.outputFormat ?? "framework") ===
                "framework" && (
                <div className="w-full rounded-lg border border-border bg-muted p-1">
                  <FrameworkTabs
                    frameworks={frameworks}
                    selectedFramework={props.selectedFramework}
                    setSelectedFramework={props.setSelectedFramework}
                    showAbout={showAbout}
                    setShowAbout={setShowAbout}
                  />
                </div>
              )}
              {props.metrics && (
                <p className="w-full text-xs text-muted-foreground">
                  {props.metrics.nodeCount} layers · {props.metrics.totalTimeMs}{" "}
                  ms
                </p>
              )}
              <CodePanel
                code={props.code}
                documentCss={props.documentCss}
                documentPreview={
                  preview.fullDocument ? preview.content : undefined
                }
                selectedFramework={props.selectedFramework}
                preferenceOptions={preferenceOptions}
                selectPreferenceOptions={selectPreferenceOptions}
                settings={props.settings}
                onPreferenceChanged={props.onPreferenceChanged}
                onDownloadProject={props.onDownloadProject}
                isDownloadingProject={props.isDownloadingProject}
                projectDownloadError={props.projectDownloadError}
              />
            </div>
          )}
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};
