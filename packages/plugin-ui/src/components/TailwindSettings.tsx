import { PluginSettings } from "types";
import FormField from "./CustomPrefixInput"; // Still importing from the same file

interface TailwindSettingsProps {
  settings: PluginSettings | null;
  onPreferenceChanged: (
    key: keyof PluginSettings,
    value: PluginSettings[keyof PluginSettings],
  ) => void;
}

export const TailwindSettings: React.FC<TailwindSettingsProps> = ({
  settings,
  onPreferenceChanged,
}) => {
  if (!settings) return null;

  const handleCustomPrefixChange = (newValue: string) => {
    onPreferenceChanged("customTailwindPrefix", newValue);
  };
  const handleBaseFontSizeChange = (value: number) => {
    onPreferenceChanged("baseFontSize", value);
  };
  const handleThresholdPercentChange = (value: number) => {
    onPreferenceChanged("thresholdPercent", value);
  };
  const handleBaseFontFamilyChange = (newValue: string) => {
    onPreferenceChanged("baseFontFamily", newValue);
  };
  const handleFontFamilyCustomConfigChange = (newValue: string) => {
    try {
      // Check if the string is empty, use default empty object
      if (!newValue.trim()) {
        onPreferenceChanged("fontFamilyCustomConfig", {});
        return;
      }

      // parse the JSON
      const config = JSON.parse(newValue);

      onPreferenceChanged("fontFamilyCustomConfig", config);
    } catch (error) {
      // Handle parsing errors
      console.error("Invalid JSON configuration:", error);
    }
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-border/60">
      <p className="text-xs font-semibold text-foreground mb-2">
        Tailwind Advanced Settings
      </p>

      {/* Advanced Settings Section */}
      <div className="ml-1 pl-2.5 border-l border-border flex flex-col gap-3">
        {/* Class name prefix setting */}
        <div>
          <FormField
            label="Custom Class Prefix"
            initialValue={settings.customTailwindPrefix || ""}
            onValueChange={(d) => {
              handleCustomPrefixChange(d as any);
            }}
            placeholder="e.g., tw-"
            helpText="Add a prefix to all generated Tailwind classes. Useful for avoiding conflicts with existing CSS. Default is empty."
            type="text"
            showPreview={true}
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Add a custom prefix to all Tailwind classes (e.g. &quot;tw-&quot;)
          </p>
        </div>

        {/* Base font size setting */}
        <div>
          <FormField
            label="Base Font Size"
            initialValue={settings.baseFontSize || 16}
            onValueChange={(d) => {
              handleBaseFontSizeChange(d as any);
            }}
            placeholder="16"
            suffix="px"
            type="number"
            min={1}
            max={100}
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Use this value to calculate rem values (default: 16px)
          </p>
        </div>

        {/* Threshold percent setting */}
        <div>
          <FormField
            label="Rounding Threshold"
            initialValue={settings.thresholdPercent || 15}
            onValueChange={(d) => {
              handleThresholdPercentChange(d as any);
            }}
            placeholder="15"
            suffix="%"
            type="number"
            min={0}
            max={50}
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Maximum allowed difference when rounding values (default: 15%)
          </p>
        </div>

        {/* Base font family setting */}
        <div>
          <FormField
            label="Base Font Family"
            initialValue={settings.baseFontFamily || ""}
            onValueChange={(d) => {
              handleBaseFontFamilyChange(String(d));
            }}
            placeholder="sans-serif"
            helpText="Font family that won't be included in generated classes."
            type="text"
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {`Elements with this font won't have "font-[<value>]" class added`}
          </p>
        </div>

        <div>
          <FormField
            type="json"
            label="Font Family Custom Config"
            initialValue={
              settings.fontFamilyCustomConfig
                ? JSON.stringify(settings.fontFamilyCustomConfig, null, 2)
                : ""
            }
            onValueChange={(d) => {
              handleFontFamilyCustomConfigChange(String(d));
            }}
            placeholder='{"sans":["Inter","sans-serif"]}'
            helpText="Paste your tailwind custom font family JSON config"
          />
          <div className="text-[11px] text-muted-foreground mt-1">
            <span>Override custom font handling e.g. &quot;font-comic&quot;</span>
            <pre className="mt-1 p-2 bg-muted/60 rounded-md border border-border/80 font-mono text-[10px] text-foreground/80 overflow-x-auto">
              {`{
  "sans": ["Inter", "sans-serif"],
  "display": ["Plus Jakarta Sans"],
  "mono": ["JetBrains Mono"]
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
