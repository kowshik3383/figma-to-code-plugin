import React, { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  XCircle,
  AlertOctagon,
  ExternalLink,
  Info,
} from "lucide-react";
import { Warning } from "types";

interface WarningsPanelProps {
  warnings: Warning[];
}

// Helper function to categorize warnings by severity
const categorizeWarnings = (warnings: Warning[]) => {
  const critical = warnings.filter(
    (w) =>
      w.toString().toLowerCase().includes("error") ||
      w.toString().toLowerCase().includes("critical") ||
      w.toString().toLowerCase().includes("missing"),
  );
  const standard = warnings.filter((w) => !critical.includes(w));

  return { critical, standard };
};

const WarningsPanel: React.FC<WarningsPanelProps> = ({ warnings }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "critical" | "standard">(
    "all",
  );
  const { critical, standard } = categorizeWarnings(warnings);

  if (warnings.length === 0) return null;

  const displayedWarnings =
    activeTab === "all"
      ? warnings
      : activeTab === "critical"
        ? critical
        : standard;

  return (
    <div className="bg-card border border-amber-500/30 rounded-xl shadow-xs overflow-hidden w-full">
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between py-2.5 px-3 border-b border-amber-500/20 bg-amber-500/8 cursor-pointer hover:bg-amber-500/12 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
      >
        <span className="flex items-center gap-2">
          <span className="text-amber-500">
            <AlertTriangle size={15} />
          </span>
          <span className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-xs">
              {warnings.length} {warnings.length === 1 ? "Warning" : "Warnings"}
            </span>
            {critical.length > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500/15 text-red-600 dark:text-red-400 rounded-full text-[10px] font-medium">
                {critical.length} critical
              </span>
            )}
          </span>
        </span>
        <span className="p-1 text-muted-foreground hover:text-foreground transition-colors">
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </button>

      {/* Warning content */}
      {!isCollapsed && (
        <div className="p-2.5 flex flex-col gap-2">
          {/* Tabs */}
          {critical.length > 0 && standard.length > 0 && (
            <div className="flex bg-muted/80 p-0.5 rounded-lg border border-border/60">
              <button
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-all flex-1 ${
                  activeTab === "all"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("all")}
              >
                All ({warnings.length})
              </button>
              <button
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-all flex-1 flex items-center justify-center gap-1 ${
                  activeTab === "critical"
                    ? "bg-card text-red-600 dark:text-red-400 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("critical")}
              >
                <AlertOctagon size={11} />
                <span>Critical ({critical.length})</span>
              </button>
              <button
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-all flex-1 flex items-center justify-center gap-1 ${
                  activeTab === "standard"
                    ? "bg-card text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("standard")}
              >
                <Info size={11} />
                <span>Other ({standard.length})</span>
              </button>
            </div>
          )}

          {/* Warning list */}
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-0.5">
            {displayedWarnings.map((message, index) => {
              const isCritical = critical.includes(message);
              return (
                <div
                  key={index}
                  className={`rounded-lg border ${
                    isCritical
                      ? "border-red-500/25 bg-red-500/5"
                      : "border-amber-500/25 bg-amber-500/5"
                  } overflow-hidden`}
                >
                  <div className="flex items-start gap-2 py-2 px-2.5">
                    <div
                      className={`mt-0.5 shrink-0 ${
                        isCritical
                          ? "text-red-500 dark:text-red-400"
                          : "text-amber-500 dark:text-amber-400"
                      }`}
                    >
                      {isCritical ? (
                        <AlertOctagon size={13} />
                      ) : (
                        <XCircle size={13} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-snug">
                        {message.toString()}
                      </p>

                      {/* Suggested fix */}
                      {isCritical && (
                        <div className="mt-1.5 bg-background/80 rounded-md py-1 px-2 text-muted-foreground border border-red-500/20 text-[11px] leading-relaxed">
                          <span className="font-semibold text-foreground">
                            Tip:{" "}
                          </span>
                          {suggestFixForWarning(message.toString())}
                        </div>
                      )}
                    </div>

                    {/* Action link */}
                    {shouldShowActionButtons(message.toString()) && (
                      <a
                        href={getDocsLinkForWarning(message.toString())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
                      >
                        <span>Docs</span>
                        <ExternalLink size={10} className="ml-0.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions (these would be expanded with actual logic in your implementation)
const suggestFixForWarning = (warning: string): string => {
  if (warning.toLowerCase().includes("missing")) {
    return "Add the required properties to your component or select a parent element that includes all necessary children.";
  }
  if (warning.toLowerCase().includes("unsupported")) {
    return "Consider using a different element type or simplifying the design for better conversion results.";
  }
  return "Check your design elements and ensure they follow the recommended structure for code conversion.";
};

const shouldShowActionButtons = (warning: string): boolean => {
  // Example condition - you would customize this based on your specific warnings
  return (
    warning.toLowerCase().includes("unsupported") ||
    warning.toLowerCase().includes("missing")
  );
};

const getDocsLinkForWarning = (warning: string): string => {
  // Example URLs - in reality you would point to specific documentation pages
  if (warning.toLowerCase().includes("unsupported")) {
    return "https://github.com/kowshik3383/figma-to-code-plugin/blob/main/docs/SUPPORTED-ELEMENTS.md";
  }
  return "https://github.com/kowshik3383/figma-to-code-plugin/blob/main/docs";
};

export default WarningsPanel;
