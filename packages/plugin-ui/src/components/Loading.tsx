import React from "react";

const Loading = () => (
  <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center select-none">
    {/* Code editor frame */}
    <div className="mb-4 w-full max-w-[250px] overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {/* Title bar */}
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 bg-muted/40">
        <div className="h-2 w-2 rounded-full bg-foreground/20" />
        <div className="h-2 w-2 rounded-full bg-foreground/20" />
        <div className="h-2 w-2 rounded-full bg-foreground/20" />
      </div>

      {/* Shimmer code lines */}
      <div className="flex flex-col gap-2.5 px-3.5 py-3.5 bg-background">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-3 rounded-full bg-foreground/20" />
          <div className="h-1.5 w-16 animate-pulse rounded-full bg-emerald-500/60" />
        </div>
        <div className="flex items-center gap-2 pl-3">
          <div className="h-1.5 w-3 rounded-full bg-foreground/20" />
          <div
            className="h-1.5 w-24 animate-pulse rounded-full bg-foreground/30"
            style={{ animationDelay: "200ms" }}
          />
        </div>
        <div className="flex items-center gap-2 pl-3">
          <div className="h-1.5 w-3 rounded-full bg-foreground/20" />
          <div
            className="h-1.5 w-20 animate-pulse rounded-full bg-foreground/30"
            style={{ animationDelay: "400ms" }}
          />
        </div>
        <div className="flex items-center gap-2 pl-6">
          <div className="h-1.5 w-3 rounded-full bg-foreground/20" />
          <div
            className="h-1.5 w-28 animate-pulse rounded-full bg-foreground/20"
            style={{ animationDelay: "600ms" }}
          />
        </div>
        <div className="flex items-center gap-2 pl-6">
          <div className="h-1.5 w-3 rounded-full bg-foreground/20" />
          <div
            className="h-1.5 w-16 animate-pulse rounded-full bg-foreground/20"
            style={{ animationDelay: "800ms" }}
          />
        </div>
        <div className="flex items-center gap-2 pl-3">
          <div className="h-1.5 w-3 rounded-full bg-foreground/20" />
          <div
            className="h-1.5 w-12 animate-pulse rounded-full bg-foreground/30"
            style={{ animationDelay: "1000ms" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-3 rounded-full bg-foreground/20" />
          <div
            className="h-1.5 w-10 animate-pulse rounded-full bg-emerald-500/60"
            style={{ animationDelay: "1200ms" }}
          />
        </div>
      </div>
    </div>

    {/* Text */}
    <h3 className="text-sm font-semibold text-foreground tracking-tight">
      Generating Code...
    </h3>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground max-w-[240px]">
      Parsing nodes, geometry, and styling.
    </p>
  </div>
);

export default Loading;
