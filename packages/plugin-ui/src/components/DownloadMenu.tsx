import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { DownloadProjectFormat, Framework } from "types";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";

type DownloadMenuProps = {
  framework: Framework;
  onDownload: (format: DownloadProjectFormat) => void;
  isDownloading?: boolean;
};

const downloadOptions: Array<{
  label: string;
  format: DownloadProjectFormat;
}> = [
  {
    label: "Vite",
    format: "vite",
  },
  {
    label: "Next.js",
    format: "nextjs",
  },
  {
    label: "HTML",
    format: "html",
  },
];

const getDownloadOptions = (_framework: Framework) => downloadOptions;

const getDownloadLabel = (_framework: Framework) => "Download project";

const DownloadMenu = ({
  framework,
  onDownload,
  isDownloading = false,
}: DownloadMenuProps) => {
  const [open, setOpen] = useState(false);
  const options = getDownloadOptions(framework);
  const directFormat = options.length === 1 ? options[0].format : null;
  const downloadLabel = getDownloadLabel(framework);
  const buttonLabel = isDownloading ? "Creating project…" : downloadLabel;

  const handleDownload = (format: DownloadProjectFormat) => {
    setOpen(false);
    onDownload(format);
  };

  if (directFormat) {
    return (
      <Button
        variant="ghost"
        size="icon-xs"
        className="h-7 w-7 rounded-md bg-muted/80 text-foreground border border-border/80 shadow-2xs transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={() => onDownload(directFormat)}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <span
            className="inline-flex animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          >
            <LoaderCircle className="h-3.5 w-3.5" />
          </span>
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 rounded-md bg-muted/80 text-foreground border border-border/80 shadow-2xs transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
            aria-label={buttonLabel}
            title={buttonLabel}
            disabled={isDownloading}
          />
        }
      >
        {isDownloading ? (
          <span
            className="inline-flex animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          >
            <LoaderCircle className="h-3.5 w-3.5" />
          </span>
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-36 gap-1 p-1 bg-card border border-border shadow-md rounded-lg">
        <PopoverHeader className="px-2 py-1 border-b border-border/60">
          <PopoverTitle className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            Download Project
          </PopoverTitle>
        </PopoverHeader>
        <div className="flex flex-col gap-0.5 pt-0.5">
          {options.map((option) => (
            <button
              key={option.format}
              className="flex w-full items-center rounded-md px-2 py-1 text-left text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted cursor-pointer"
              onClick={() => handleDownload(option.format)}
              disabled={isDownloading}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DownloadMenu;
