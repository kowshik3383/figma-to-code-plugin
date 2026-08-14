import { HelpCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type SelectableToggleProps = {
  onSelect: (isSelected: boolean) => void;
  isSelected?: boolean;
  title: string;
  description?: string;
  buttonClass: string;
  checkClass: string;
};

const SelectableToggle = ({
  onSelect,
  isSelected = false,
  title,
  description,
}: SelectableToggleProps) => {
  const handleClick = () => {
    onSelect(!isSelected);
  };

  return (
    <div className="relative inline-block">
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={isSelected}
        onClick={handleClick}
        className={cn(
          "h-7 px-2.5 rounded-lg border transition-all duration-150 cursor-pointer select-none",
          isSelected
            ? "bg-muted text-foreground border-foreground/30 shadow-2xs font-medium"
            : "bg-muted/40 text-muted-foreground border-border/80 hover:bg-muted/80 hover:text-foreground",
        )}
      >
        <div className="flex items-center gap-1.5">
          <Checkbox
            checked={isSelected}
            tabIndex={-1}
            className={cn(
              "pointer-events-none h-3.5 w-3.5 rounded-[4px] transition-all duration-150",
              isSelected
                ? "bg-foreground text-background border-foreground"
                : "bg-background border-border",
            )}
          />

          <span
            className={cn(
              "text-xs whitespace-nowrap",
              isSelected
                ? "text-foreground font-medium"
                : "text-muted-foreground",
            )}
          >
            {title}
          </span>

          {/* Help icon for description */}
          {description && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex cursor-help opacity-70 hover:opacity-100 transition-opacity ml-0.5" />
                }
              >
                <HelpCircle size={11} />
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-xs">
                {description}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </Button>
    </div>
  );
};

export default SelectableToggle;
