import {
  Framework,
  DownloadFormat,
  OutputFormat,
  LocalCodegenPreferenceOptions,
  PluginSettings,
  SelectPreferenceOptions,
} from "types";
import { useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark as theme } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CopyButton } from "./CopyButton";
import EmptyState from "./EmptyState";
import SettingsGroup from "./SettingsGroup";
import FrameworkTabs from "./FrameworkTabs";
import { TailwindSettings } from "./TailwindSettings";
import DownloadMenu from "./DownloadMenu";
import CustomImagePathInput from "./CustomImagePathInput";

interface CodePanelProps {
  code: string;
  documentCss?: string;
  documentPreview?: string;
  selectedFramework: Framework;
  settings: PluginSettings | null;
  preferenceOptions: LocalCodegenPreferenceOptions[];
  selectPreferenceOptions: SelectPreferenceOptions[];
  onPreferenceChanged: (
    key: keyof PluginSettings,
    value: PluginSettings[keyof PluginSettings],
  ) => void;
  onDownloadProject?: (format: DownloadFormat) => void;
  isDownloadingProject?: boolean;
  projectDownloadError?: string | null;
}

const CodePanel = (props: CodePanelProps) => {
  const [view, setView] = useState<"all" | "style" | "body">("all");
  const [syntaxHovered, setSyntaxHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const initialLinesToShow = 25;
  const {
    code,
    preferenceOptions,
    selectPreferenceOptions,
    selectedFramework,
    settings,
    onPreferenceChanged,
    onDownloadProject,
    isDownloadingProject = false,
    projectDownloadError,
  } = props;
  const isCodeEmpty = code === "";
  const format = settings?.outputFormat ?? "framework";
  const documentMode = format !== "framework";
  const references = settings?.embedDocumentImages === false;
  const controlStyle =
    "rounded-md border border-border bg-background px-2 py-1 text-xs";
  const openPreview = () => {
    if (!props.documentPreview) return;
    const url = URL.createObjectURL(
      new Blob([props.documentPreview], { type: "text/html;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  // Helper function to add the prefix before every class (or className) in the code.
  // It finds every occurrence of class="..." or className="..." and, for each class,
  // prepends the custom prefix.
  const applyPrefixToClasses = (
    codeString: string,
    prefix: string | undefined,
  ) => {
    if (!prefix) {
      return codeString;
    }

    return codeString.replace(
      /(class(?:Name)?)="([^"]*)"/g,
      (match, attr, classes) => {
        const prefixedClasses = classes
          .split(/\s+/)
          .filter(Boolean)
          .map((cls: string) => prefix + cls)
          .join(" ");
        return `${attr}="${prefixedClasses}"`;
      },
    );
  };

  // Function to truncate code to a specific number of lines
  const truncateCode = (codeString: string, lines: number) => {
    const codeLines = codeString.split("\n");
    if (codeLines.length <= lines) {
      return codeString;
    }
    return codeLines.slice(0, lines).join("\n") + "\n...";
  };

  // If the selected framework is Tailwind and a prefix is provided then transform the code.
  const prefixedCode =
    !documentMode &&
    selectedFramework === "Tailwind" &&
    settings?.customTailwindPrefix?.trim() !== ""
      ? applyPrefixToClasses(code, settings?.customTailwindPrefix)
      : code;

  const viewedCode =
    documentMode && view === "style"
      ? (props.documentCss ??
        code.match(/<style>([\s\S]*?)<\/style>/)?.[1]?.trim() ??
        "")
      : documentMode && view === "body"
        ? (code.match(/<body>([\s\S]*?)<\/body>/)?.[1]?.trim() ?? "")
        : prefixedCode;

  const highlightedCode = useMemo(
    () =>
      documentMode
        ? viewedCode.replace(
            /(data:image\/[^;,]+;base64,[A-Za-z0-9+/]{80})[A-Za-z0-9+/=]{256,}/g,
            "$1…",
          )
        : viewedCode,
    [documentMode, viewedCode],
  );

  // Memoize the line count calculation to improve performance for large code blocks
  const lineCount = useMemo(() => viewedCode.split("\n").length, [viewedCode]);

  // Determine if code should be truncated
  const shouldTruncate = !isExpanded && lineCount > initialLinesToShow;
  const displayedCode = shouldTruncate
    ? truncateCode(highlightedCode, initialLinesToShow)
    : highlightedCode;
  const showMoreButton = lineCount > initialLinesToShow;
  const showCodeCopyButton = lineCount > 5;
  const canDownloadProject =
    selectedFramework === "HTML" || selectedFramework === "Tailwind";

  const handleButtonHover = () => setSyntaxHovered(true);
  const handleButtonLeave = () => setSyntaxHovered(false);

  // Memoized preference groups for better performance
  const {
    essentialPreferences,
    stylingPreferences,
    selectableSettingsFiltered,
  } = useMemo(() => {
    // Get preferences for the current framework
    const frameworkPreferences = preferenceOptions.filter((preference) =>
      preference.includedLanguages?.includes(selectedFramework),
    );

    // Define preference grouping based on property names
    const essentialPropertyNames = ["jsx"];
    const stylingPropertyNames = [
      "useTailwind4",
      "roundTailwindValues",
      "roundTailwindColors",
      "useColorVariables",
      "showLayerNames",
      "embedImages",
      "embedVectors",
    ];

    // Group preferences by category
    return {
      essentialPreferences: frameworkPreferences.filter((p) =>
        essentialPropertyNames.includes(p.propertyName),
      ),
      stylingPreferences: frameworkPreferences.filter((p) =>
        stylingPropertyNames.includes(p.propertyName),
      ),
      selectableSettingsFiltered: selectPreferenceOptions.filter((p) =>
        p.includedLanguages?.includes(selectedFramework),
      ),
    };
  }, [preferenceOptions, selectPreferenceOptions, selectedFramework]);

  const hasSettingsBeforeStyling =
    essentialPreferences.length > 0 || selectableSettingsFiltered.length > 0;

  return (
    <div className="w-full flex flex-col gap-2.5">
      <label className="flex items-center justify-between gap-2 text-xs">
        Output format
        <select
          className={controlStyle}
          value={format}
          onChange={(event) => {
            setView("all");
            onPreferenceChanged(
              "outputFormat",
              event.currentTarget.value as OutputFormat,
            );
          }}
        >
          <option value="single-html">Single HTML file</option>
          <option value="separate-html">Separate HTML + CSS files</option>
          <option value="framework">Framework options</option>
        </select>
      </label>
      {format === "single-html" && (
        <label className="flex items-center justify-between gap-2 text-xs">
          Images
          <select
            className={controlStyle}
            value={references ? "reference" : "embed"}
            onChange={(event) =>
              onPreferenceChanged(
                "embedDocumentImages",
                event.currentTarget.value === "embed",
              )
            }
          >
            <option value="embed">Embed images</option>
            <option value="reference">Reference files (assets/)</option>
          </select>
        </label>
      )}
      {documentMode && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={settings?.linkGoogleFonts === true}
            onChange={(event) =>
              onPreferenceChanged(
                "linkGoogleFonts",
                event.currentTarget.checked,
              )
            }
          />
          Load supported Google Fonts online
        </label>
      )}
      {documentMode && !isCodeEmpty && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={controlStyle}
            aria-label="Code section"
            value={view}
            onChange={(event) =>
              setView(event.currentTarget.value as typeof view)
            }
          >
            <option value="all">Full document</option>
            <option value="style">Style only</option>
            <option value="body">Body only</option>
          </select>
          {onDownloadProject && (
            <button
              className={controlStyle}
              disabled={isDownloadingProject}
              onClick={() => onDownloadProject(format)}
            >
              {format === "single-html"
                ? "Download .html"
                : "Download HTML + CSS"}
            </button>
          )}
          {format === "single-html" && references && onDownloadProject && (
            <button
              className={controlStyle}
              disabled={isDownloadingProject}
              onClick={() => onDownloadProject("html-assets")}
            >
              Download assets ZIP
            </button>
          )}
          <button
            className={controlStyle}
            disabled={!props.documentPreview}
            onClick={openPreview}
          >
            Open in new tab
          </button>
        </div>
      )}
      <div className="flex items-center justify-between w-full">
        <h2 className="text-xs font-semibold text-foreground tracking-tight">
          Code Output
        </h2>
        {!isCodeEmpty && (
          <div className="flex items-center gap-1.5">
            {!documentMode && onDownloadProject && canDownloadProject && (
              <DownloadMenu
                framework={selectedFramework}
                onDownload={onDownloadProject}
                isDownloading={isDownloadingProject}
              />
            )}
            <CopyButton
              value={viewedCode}
              onMouseEnter={handleButtonHover}
              onMouseLeave={handleButtonLeave}
            />
          </div>
        )}
      </div>

      {highlightedCode !== viewedCode && (
        <p className="text-xs text-muted-foreground">
          Embedded image data is shortened in the code view. Copy includes the
          full data.
        </p>
      )}
      {projectDownloadError && (
        <p
          className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2"
          role="alert"
        >
          {projectDownloadError}
        </p>
      )}

      {!documentMode && !isCodeEmpty && (
        <div className="flex flex-col p-3 bg-card border border-border rounded-xl text-sm shadow-xs">
          {/* Essential settings always shown */}
          <SettingsGroup
            title=""
            settings={essentialPreferences}
            alwaysExpanded={true}
            selectedSettings={settings}
            onPreferenceChanged={onPreferenceChanged}
          />

          {/* Framework-specific options */}
          {selectableSettingsFiltered.length > 0 && (
            <div className="mb-2 flex flex-col gap-1.5 last:mb-0">
              <p className="text-xs font-medium text-muted-foreground">
                {selectedFramework} Mode
              </p>
              {selectableSettingsFiltered.map((preference) => {
                return (
                  <FrameworkTabs
                    key={preference.propertyName}
                    options={preference.options}
                    selectedValue={
                      (settings?.[preference.propertyName] ??
                        preference.options.find((option) => option.isDefault)
                          ?.value ??
                        "") as string
                    }
                    onChange={(value) => {
                      onPreferenceChanged(preference.propertyName, value);
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Styling preferences with custom prefix for Tailwind */}
          {(stylingPreferences.length > 0 ||
            selectedFramework === "Tailwind") && (
            <div
              className={
                hasSettingsBeforeStyling
                  ? "mt-2 pt-2 border-t border-border/60"
                  : undefined
              }
            >
              <SettingsGroup
                title="Styling Options"
                settings={stylingPreferences}
                alwaysExpanded={true}
                selectedSettings={settings}
                onPreferenceChanged={onPreferenceChanged}
              >
                <CustomImagePathInput
                  initialValue={settings?.customImagePath ?? "images/"}
                  onValueChange={(val) =>
                    onPreferenceChanged("customImagePath", val)
                  }
                />
                {selectedFramework === "Tailwind" && (
                  <TailwindSettings
                    settings={settings}
                    onPreferenceChanged={onPreferenceChanged}
                  />
                )}
              </SettingsGroup>
            </div>
          )}
        </div>
      )}

      <div
        className={`relative rounded-xl overflow-hidden border transition-all duration-200 shadow-xs ${
          syntaxHovered
            ? "border-neutral-700 ring-2 ring-foreground/10"
            : "border-neutral-800"
        }`}
      >
        {isCodeEmpty ? (
          <EmptyState />
        ) : (
          <>
            {showCodeCopyButton && (
              <div className="pointer-events-none sticky top-3 z-10 h-0">
                <CopyButton
                  value={viewedCode}
                  showLabel={false}
                  onMouseEnter={handleButtonHover}
                  onMouseLeave={handleButtonLeave}
                  className="pointer-events-auto absolute right-2.5 top-2.5 h-7 w-7 rounded-md bg-neutral-900/90 p-0 text-neutral-200 shadow-xs border border-neutral-700/80 backdrop-blur-xs hover:bg-neutral-800 hover:text-white"
                />
              </div>
            )}
            <SyntaxHighlighter
              language={
                documentMode
                  ? view === "style"
                    ? "css"
                    : "html"
                  : (selectedFramework === "HTML" &&
                        settings?.htmlGenerationMode === "styled-components") ||
                      (selectedFramework === "Tailwind" &&
                        settings?.tailwindGenerationMode === "jsx") ||
                      (selectedFramework === "HTML" &&
                        settings?.htmlGenerationMode === "jsx")
                    ? "jsx"
                    : "html"
              }
              style={theme}
              customStyle={{
                fontSize: 12,
                borderRadius: 0,
                marginTop: 0,
                marginBottom: 0,
                padding: "12px 14px",
                backgroundColor: syntaxHovered ? "#141414" : "#1B1B1B",
                transitionProperty: "all",
                transitionTimingFunction: "ease",
                transitionDuration: "0.2s",
              }}
            >
              {displayedCode}
            </SyntaxHighlighter>
            {showMoreButton && (
              <div className="flex justify-center bg-[#1B1B1B] border-t border-neutral-800">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs w-full flex justify-center py-2.5 font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
                  aria-label="Show more code"
                  title="Show more code"
                >
                  {isExpanded ? "Show Less" : "Show More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CodePanel;
