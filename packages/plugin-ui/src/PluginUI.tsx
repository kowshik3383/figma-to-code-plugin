import copy from "copy-to-clipboard";
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
  DownloadProjectFormat,
  HTMLPreview,
  LinearGradientConversion,
  PluginSettings,
  SolidColorConversion,
  Warning,
  DetectedAsset,
} from "types";
import {
  preferenceOptions,
  selectPreferenceOptions,
} from "./codegenPreferenceOptions";
import Loading from "./components/Loading";
import { useEffect, useState } from "react";
import { InfoIcon } from "lucide-react";
import React from "react";
import { ScrollArea } from "./components/ui/scroll-area";
import { TooltipProvider } from "./components/ui/tooltip";

type PluginUIProps = {
  code: string;
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
  isLoading: boolean;
  onDownloadProject?: (format: DownloadProjectFormat) => void;
  isDownloadingProject?: boolean;
  projectDownloadError?: string | null;
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

  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewViewMode, setPreviewViewMode] = useState<
    "desktop" | "mobile" | "precision"
  >("precision");
  const [previewBgColor, setPreviewBgColor] = useState<"white" | "black">(
    "white",
  );

  if (props.isLoading) {
    return <DelayedLoading />;
  }

  const isEmpty = props.code === "";
  const warnings = props.warnings ?? [];

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-hidden bg-background text-foreground selection:bg-neutral-200 dark:selection:bg-neutral-800">
        {/* Top Header Bar */}
        <header className="px-2.5 py-2 border-b border-border bg-card/60 backdrop-blur-xs flex items-center gap-1.5 shrink-0">
          <div className="flex gap-1 bg-muted/80 border border-border/80 rounded-lg p-0.5 grow items-center">
            <FrameworkTabs
              frameworks={frameworks}
              selectedFramework={props.selectedFramework}
              setSelectedFramework={props.setSelectedFramework}
              showAbout={showAbout}
              setShowAbout={setShowAbout}
            />
            <button
              type="button"
              className={`h-7.5 w-7.5 rounded-md flex items-center justify-center transition-all duration-150 shrink-0 ${
                showAbout
                  ? "bg-foreground text-background shadow-xs ring-1 ring-foreground/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 dark:hover:bg-muted/60"
              }`}
              onClick={() => {
                setShowAbout(!showAbout);
              }}
              aria-label="About Figma to Code"
              title="About Figma to Code"
              aria-pressed={showAbout}
            >
              <InfoIcon size={14} />
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          {showAbout ? (
            <About
              useOldPluginVersion={props.settings?.useOldPluginVersion2025}
              onPreferenceChanged={props.onPreferenceChanged}
            />
          ) : isEmpty ? (
            <div className="flex min-h-full items-center justify-center p-4">
              <EmptyState />
            </div>
          ) : (
            <div className="flex flex-col items-center px-3.5 pt-3 pb-4 gap-3 w-full max-w-full">
              {props.htmlPreview && (
                <Preview
                  htmlPreview={props.htmlPreview}
                  expanded={previewExpanded}
                  setExpanded={setPreviewExpanded}
                  viewMode={previewViewMode}
                  setViewMode={setPreviewViewMode}
                  bgColor={previewBgColor}
                  setBgColor={setPreviewBgColor}
                />
              )}

              {warnings.length > 0 && <WarningsPanel warnings={warnings} />}

              <CodePanel
                code={props.code}
                selectedFramework={props.selectedFramework}
                preferenceOptions={preferenceOptions}
                selectPreferenceOptions={selectPreferenceOptions}
                settings={props.settings}
                onPreferenceChanged={props.onPreferenceChanged}
                onDownloadProject={props.onDownloadProject}
                isDownloadingProject={props.isDownloadingProject}
                projectDownloadError={props.projectDownloadError}
              />

              {props.assets && props.assets.length > 0 && (
                <div className="w-full">
                  <AssetsPanel assets={props.assets} />
                </div>
              )}

              {props.colors.length > 0 && (
                <div className="w-full">
                  <ColorsPanel
                    colors={props.colors}
                    onColorClick={(value) => {
                      copy(value);
                    }}
                  />
                </div>
              )}

              {props.gradients.length > 0 && (
                <div className="w-full">
                  <GradientsPanel
                    gradients={props.gradients}
                    onColorClick={(value) => {
                      copy(value);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};
