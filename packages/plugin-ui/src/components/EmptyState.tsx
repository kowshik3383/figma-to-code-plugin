import React from "react";

const EmptyState = () => {
  return (
    <div className="flex w-full flex-col items-center justify-center px-4 py-12 text-center select-none">
      {/* Illustration: a Figma-style selection box turning into code */}
      <div className="mb-4 text-foreground/80">
        <svg
          width="170"
          height="110"
          viewBox="0 0 148 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-xs"
          aria-hidden="true"
        >
          {/* Layer rectangle with selection handles */}
          <rect
            x="8"
            y="16"
            width="52"
            height="64"
            rx="5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            className="text-foreground/40"
          />
          {/* Selection handles */}
          <rect
            x="5"
            y="13"
            width="6"
            height="6"
            rx="1.5"
            className="fill-foreground stroke-background stroke-[1.5]"
          />
          <rect
            x="5"
            y="77"
            width="6"
            height="6"
            rx="1.5"
            className="fill-foreground stroke-background stroke-[1.5]"
          />
          <rect
            x="57"
            y="13"
            width="6"
            height="6"
            rx="1.5"
            className="fill-foreground stroke-background stroke-[1.5]"
          />
          <rect
            x="57"
            y="77"
            width="6"
            height="6"
            rx="1.5"
            className="fill-foreground stroke-background stroke-[1.5]"
          />

          {/* Inner content lines (representing layer content) */}
          <rect
            x="18"
            y="30"
            width="32"
            height="3"
            rx="1.5"
            className="fill-foreground/20"
          />
          <rect
            x="18"
            y="39"
            width="24"
            height="3"
            rx="1.5"
            className="fill-foreground/15"
          />
          <rect
            x="18"
            y="54"
            width="28"
            height="3"
            rx="1.5"
            className="fill-foreground/20"
          />
          <rect
            x="18"
            y="63"
            width="18"
            height="3"
            rx="1.5"
            className="fill-foreground/15"
          />

          {/* Arrow */}
          <path
            d="M72 48 L84 48"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-muted-foreground/60"
          />
          <path
            d="M81 44 L85 48 L81 52"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground/60"
          />

          {/* Code block */}
          <rect
            x="92"
            y="20"
            width="52"
            height="56"
            rx="6"
            className="fill-[#1B1B1B] stroke-neutral-700/80"
            strokeWidth="1"
          />
          {/* Code lines */}
          <rect
            x="100"
            y="32"
            width="20"
            height="2.5"
            rx="1.25"
            className="fill-emerald-400/90"
          />
          <rect
            x="104"
            y="40"
            width="28"
            height="2.5"
            rx="1.25"
            className="fill-neutral-400"
          />
          <rect
            x="104"
            y="48"
            width="22"
            height="2.5"
            rx="1.25"
            className="fill-neutral-400"
          />
          <rect
            x="104"
            y="56"
            width="16"
            height="2.5"
            rx="1.25"
            className="fill-neutral-500"
          />
          <rect
            x="100"
            y="64"
            width="12"
            height="2.5"
            rx="1.25"
            className="fill-emerald-400/90"
          />
        </svg>
      </div>

      {/* Copy */}
      <h3 className="text-sm font-semibold text-foreground tracking-tight">
        No Layer Selected
      </h3>
      <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
        Select a layer or frame in Figma to inspect and generate code.
      </p>
    </div>
  );
};

export default EmptyState;
