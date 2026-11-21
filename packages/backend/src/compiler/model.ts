// This module is the format boundary. It must remain independent of the Figma API.
export type AssetFormat = "PNG" | "SVG";
export type SemanticTag =
  | "div"
  | "section"
  | "article"
  | "header"
  | "footer"
  | "nav"
  | "p"
  | "span"
  | "h1"
  | "h2"
  | "h3";
export type Style = Record<string, string>;

export interface DesignAsset {
  id: string;
  name: string;
  format: AssetFormat;
  placement: "image" | "background";
  width: number;
  height: number;
}

export type Alignment =
  | "start"
  | "center"
  | "end"
  | "space-between"
  | "baseline";
export type DesignLayout =
  | { kind: "freeform" }
  | {
      kind: "flex";
      axis: "horizontal" | "vertical";
      wrap: boolean;
      gap?: string;
      main: Alignment;
      cross: Alignment;
      padding: [string, string, string, string];
    }
  | {
      kind: "grid";
      columns: GridTrack[];
      rows: GridTrack[];
      columnGap: string;
      rowGap: string;
    };

export type GridTrack = { kind: "fixed"; pixels: number } | { kind: "flex" };

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualLayer {
  bounds: Bounds;
  renderedBounds?: Bounds;
  type: string;
  order: number;
  clips: boolean;
  mixed: boolean;
  explicitWidth?: boolean;
  sizing: {
    horizontal: "hug" | "fill" | "fixed";
    vertical: "hug" | "fill" | "fixed";
  };
  textMetrics?: {
    autoResize: string;
    lineHeight: string;
    letterSpacing: string;
    fontFamily: string;
  };
  complex: boolean;
  maskedStack: boolean;
  reverseOrder: boolean;
  fills: { kind: string; opacity: number }[];
}

export interface DesignNode {
  visual: VisualLayer;
  id: string;
  name: string;
  tag: SemanticTag;
  style: Style;
  layout?: DesignLayout;
  gridCell?: {
    row: number;
    column: number;
    rowSpan: number;
    columnSpan: number;
  };
  text?: string;
  asset?: DesignAsset;
  component?: {
    kind: "definition" | "instance" | "set";
    key?: string;
    properties?: Record<string, string | boolean>;
    variants?: Record<string, string>;
  };
  children: DesignNode[];
}

export interface DesignDocument {
  version: 1;
  roots: DesignNode[];
  assets: DesignAsset[];
  tokens: Record<string, string>;
  diagnostics: string[];
}

export interface RenderOptions {
  assetUrl: (asset: DesignAsset) => string | undefined;
}

export interface DesignGenerator {
  render(document: DesignDocument, options: RenderOptions): string;
}
