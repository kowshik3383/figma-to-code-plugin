import { useState } from "react";
import {
  ArrowRightIcon,
  Code,
  Heart,
  Lock,
  MessageCircle,
  Star,
  Zap,
  Copy,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { PluginSettings } from "types";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { cn } from "../lib/utils";

type AboutProps = {
  useOldPluginVersion?: boolean;
  onPreferenceChanged: (
    key: keyof PluginSettings,
    value: PluginSettings[keyof PluginSettings],
  ) => void;
};

const About = ({
  useOldPluginVersion = false,
  onPreferenceChanged,
}: AboutProps) => {
  const [copied, setCopied] = useState(false);

  const copySelectionJson = async () => {
    try {
      // Send message to the plugin to get selection JSON
      parent.postMessage(
        { pluginMessage: { type: "get-selection-json" } },
        "*",
      );

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy selection JSON:", error);
    }
  };

  const togglePluginVersion = () => {
    onPreferenceChanged("useOldPluginVersion2025", !useOldPluginVersion);
  };

  return (
    <div className="flex flex-col p-5 gap-6 text-sm max-w-2xl mx-auto">
      {/* Header Section with Logo and Title */}
      <div className="flex flex-col items-center text-center mb-2">
        <div className="w-16 h-16 bg-linear-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg mb-3">
          <Code size={32} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold mb-1">Figma to Code</h2>
        <div className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
          <span>Created with</span>
          <Heart size={14} className="text-red-500 fill-red-500" />
          <span>by Bernardo Ferrari</span>
        </div>
        <div className="mt-3 flex gap-3">
          <a
            href="https://github.com/bernaferrari"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
            aria-label="GitHub Profile"
          >
            <GithubLogo />
          </a>
          <a
            href="https://twitter.com/bernaferrari"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
            aria-label="Twitter Profile"
          >
            <XLogo />
          </a>
        </div>
      </div>

      {/* Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Privacy Policy Card */}
        <Card className="border-border bg-card shadow-xs py-0 transition-all duration-150 hover:border-foreground/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                <Lock size={16} />
              </div>
              <h3 className="font-semibold text-xs text-foreground">Privacy Policy</h3>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              This plugin is completely private. All of your design data is
              processed locally in your browser and never leaves your computer.
              No analytics, no data collection, no tracking.
            </p>
          </CardContent>
        </Card>

        {/* Open Source Card */}
        <Card className="border-border bg-card shadow-xs py-0 transition-all duration-150 hover:border-foreground/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
                <GithubLogo className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-xs text-foreground">Open Source</h3>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed mb-3">
              Figma to Code is completely open-source. Contributions, bug
              reports, and feature requests are welcome!
            </p>
            <a
              href="https://github.com/bernaferrari/figmatocode"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-fit text-xs gap-1.5 bg-muted/60 hover:bg-muted text-foreground border-border",
              )}
            >
              <Star size={12} className="text-amber-500 fill-amber-500" />
              <span>View on GitHub</span>
            </a>
          </CardContent>
        </Card>

        {/* Features Card */}
        <Card className="border-border bg-card shadow-xs py-0 transition-all duration-150 hover:border-foreground/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                <Zap size={16} />
              </div>
              <h3 className="font-semibold text-xs text-foreground">Features</h3>
            </div>
            <ul className="text-muted-foreground text-xs space-y-1.5 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <div className="mt-0.5 text-foreground/60">
                  <ArrowRightIcon size={12} />
                </div>
                <span>Convert Figma designs to HTML and Tailwind</span>
              </li>
              <li className="flex items-start gap-1.5">
                <div className="mt-0.5 text-foreground/60">
                  <ArrowRightIcon size={12} />
                </div>
                <span>Extract colors and gradients from your designs</span>
              </li>
              <li className="flex items-start gap-1.5">
                <div className="mt-0.5 text-foreground/60">
                  <ArrowRightIcon size={12} />
                </div>
                <span>Get responsive code that matches your design</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Contact Card */}
        <Card className="border-border bg-card shadow-xs py-0 transition-all duration-150 hover:border-foreground/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <MessageCircle size={16} />
              </div>
              <h3 className="font-semibold text-xs text-foreground">Get in Touch</h3>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed mb-3">
              Have feedback, questions, or need help? Open a GitHub issue:
            </p>
            <div>
              <a
                href="https://github.com/bernaferrari/figmato-code/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <GithubLogo width={14} height={14} />
                <span>Report an issue on GitHub</span>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Debug Helper Card */}
        <Card className="border-border bg-card shadow-xs py-0 transition-all duration-150 hover:border-foreground/20 md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg">
                <Code size={16} />
              </div>
              <h3 className="font-semibold text-xs text-foreground">Debug Helper</h3>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed mb-3">
              Having an issue? Help debug by copying the JSON of your selected elements:
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={copySelectionJson}
              className="mb-2 text-xs gap-1.5 bg-muted/60 hover:bg-muted text-foreground border-border"
            >
              {copied ? (
                <>
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Selection JSON</span>
                </>
              )}
            </Button>

            {/* Version toggle */}
            <div className="mt-3 pt-3 border-t border-border/80">
              <button
                onClick={togglePluginVersion}
                className="inline-flex items-center gap-2 w-full text-left text-muted-foreground text-xs hover:text-foreground transition-colors cursor-pointer"
              >
                {useOldPluginVersion ? (
                  <ToggleRight size={16} className="text-emerald-500" />
                ) : (
                  <ToggleLeft size={16} className="text-muted-foreground" />
                )}
                <span>Use previous engine version</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="mt-1 text-center text-muted-foreground/70 text-[11px]">
        <p>© {new Date().getFullYear()} Bernardo Ferrari. Open source software.</p>
      </footer>
    </div>
  );
};

function GithubLogo({
  width = 18,
  height = 18,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      fill="currentColor"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.16c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18.92-.25 1.9-.38 2.87-.39.98.01 1.96.14 2.88.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.58.23 2.75.12 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.42.36.78 1.06.78 2.14v3.18c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function XLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      fill="currentColor"
      viewBox="0 0 256 256"
    >
      <path d="M214.75,211.71l-62.6-98.38,61.77-67.95a8,8,0,0,0-11.84-10.76L143.24,99.34,102.75,35.71A8,8,0,0,0,96,32H48a8,8,0,0,0-6.75,12.3l62.6,98.37-61.77,68a8,8,0,1,0,11.84,10.76l58.84-64.72,40.49,63.63A8,8,0,0,0,160,224h48a8,8,0,0,0,6.75-12.29ZM164.39,208,62.57,48h29L193.43,208Z"></path>
    </svg>
  );
}

export default About;
