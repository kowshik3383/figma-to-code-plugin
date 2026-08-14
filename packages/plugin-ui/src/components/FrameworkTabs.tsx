import React from "react";
import { Button } from "./ui/button";

type Option = {
  value: string;
  label: string;
};

interface FrameworkTabsProps {
  options: Option[];
  selectedValue: string;
  onChange: (value: string) => void;
}

const FrameworkTabs: React.FC<FrameworkTabsProps> = ({
  options,
  selectedValue,
  onChange,
}) => {
  return (
    <div className="flex flex-wrap gap-1">
      <div className="flex flex-wrap bg-muted/80 p-0.5 rounded-lg gap-0.5 w-fit border border-border/60">
        {options.map((option) => {
          const isSelected = option.value === selectedValue;
          return (
            <button
              type="button"
              key={option.value}
              onClick={() => onChange(option.value)}
              aria-pressed={isSelected}
              className={`h-6.5 rounded-md px-2.5 text-xs font-semibold tracking-tight transition-all duration-150 cursor-pointer select-none ${
                isSelected
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FrameworkTabs;
