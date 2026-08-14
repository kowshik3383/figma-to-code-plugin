import { useState, ReactNode } from "react";
import { LocalCodegenPreferenceOptions, PluginSettings } from "types";
import SelectableToggle from "./SelectableToggle";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

interface SettingsGroupProps {
  title: string;
  settings?: LocalCodegenPreferenceOptions[];
  alwaysExpanded?: boolean;
  selectedSettings?: PluginSettings | null;
  onPreferenceChanged?: (
    key: keyof PluginSettings,
    value: PluginSettings[keyof PluginSettings],
  ) => void;
  children?: ReactNode;
}

const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  settings = [],
  alwaysExpanded = false,
  selectedSettings,
  onPreferenceChanged,
  children,
}) => {
  const [expanded, setExpanded] = useState(alwaysExpanded);

  const hasContent = settings.length > 0 || children;

  if (!hasContent) {
    return null;
  }

  return (
    <Collapsible
      open={expanded || alwaysExpanded}
      onOpenChange={setExpanded}
      className="w-full mb-2.5 last:mb-0"
    >
      {alwaysExpanded ? (
        <div className="flex items-center mb-1">
          <span className="text-xs font-semibold text-foreground">{title}</span>
        </div>
      ) : (
        <CollapsibleTrigger
          render={
            <button
              className="flex items-center justify-start gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left h-auto p-0"
              aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
            />
          }
        >
          {expanded ? (
            <ChevronDownIcon className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ChevronRightIcon className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">{title}</span>
        </CollapsibleTrigger>
      )}

      <CollapsibleContent>
        <div
          className={`flex flex-col gap-2.5 ${!alwaysExpanded ? "px-4 mt-2" : ""}`}
        >
          {/* Render preference toggles if any */}
          {settings.length > 0 && (
            <div className="flex gap-2 items-center flex-wrap">
              {settings.map((preference) => (
                <SelectableToggle
                  key={preference.propertyName}
                  title={preference.label}
                  description={preference.description}
                  isSelected={
                    typeof selectedSettings?.[preference.propertyName] ===
                    "boolean"
                      ? (selectedSettings?.[preference.propertyName] as boolean)
                      : preference.isDefault
                  }
                  onSelect={(value) => {
                    onPreferenceChanged?.(preference.propertyName, value);
                  }}
                  buttonClass="bg-muted text-foreground ring-1 ring-foreground/20 border-foreground/30 font-medium"
                  checkClass="bg-foreground text-background border-foreground"
                />
              ))}
            </div>
          )}
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SettingsGroup;
