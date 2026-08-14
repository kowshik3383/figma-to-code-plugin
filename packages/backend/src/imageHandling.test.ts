import { describe, expect, it } from "vitest";
import { getImageFills, nodeHasImageFill } from "./common/images";
import { isLikelyIcon } from "./altNodes/iconDetection";
import { htmlMain } from "./html/htmlMain";
import { tailwindMain } from "./tailwind/tailwindMain";
import type { PluginSettings } from "types";

const defaultSettings: PluginSettings = {
  framework: "HTML",
  showLayerNames: false,
  useOldPluginVersion2025: false,
  responsiveRoot: false,
  roundTailwindValues: true,
  roundTailwindColors: true,
  useColorVariables: false,
  customTailwindPrefix: "",
  embedImages: false,
  embedVectors: true,
  customImagePath: "images/",
  htmlGenerationMode: "html",
  tailwindGenerationMode: "jsx",
  baseFontSize: 16,
  useTailwind4: true,
  thresholdPercent: 15,
  baseFontFamily: "",
  fontFamilyCustomConfig: {},
};

describe("nodeHasImageFill and getImageFills", () => {
  it("returns false for undefined, null, or empty fills", () => {
    expect(nodeHasImageFill(null)).toBe(false);
    expect(nodeHasImageFill(undefined)).toBe(false);
    expect(nodeHasImageFill({} as any)).toBe(false);
    expect(nodeHasImageFill({ fills: [] } as any)).toBe(false);
  });

  it("returns false for solid and gradient fills", () => {
    const solidNode = {
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
    };
    expect(nodeHasImageFill(solidNode as any)).toBe(false);
    expect(getImageFills(solidNode as any)).toHaveLength(0);
  });

  it("returns true for active visible image fills", () => {
    const imageNode = {
      fills: [
        {
          type: "IMAGE",
          imageRef: "ref_123",
          scaleMode: "FILL",
          visible: true,
        },
      ],
    };
    expect(nodeHasImageFill(imageNode as any)).toBe(true);
    expect(getImageFills(imageNode as any)).toHaveLength(1);
  });

  it("returns false for invisible image fills or zero opacity", () => {
    const hiddenImageNode = {
      fills: [
        {
          type: "IMAGE",
          imageRef: "ref_123",
          scaleMode: "FILL",
          visible: false,
        },
      ],
    };
    expect(nodeHasImageFill(hiddenImageNode as any)).toBe(false);

    const zeroOpacityImageNode = {
      fills: [
        {
          type: "IMAGE",
          imageRef: "ref_123",
          scaleMode: "FILL",
          visible: true,
          opacity: 0,
        },
      ],
    };
    expect(nodeHasImageFill(zeroOpacityImageNode as any)).toBe(false);
  });

  it("returns false for mask nodes", () => {
    const maskNode = {
      isMask: true,
      fills: [
        {
          type: "IMAGE",
          imageRef: "ref_123",
          scaleMode: "FILL",
          visible: true,
        },
      ],
    };
    expect(nodeHasImageFill(maskNode as any)).toBe(false);
  });

  it("returns true for mixed fills where at least one is a visible image", () => {
    const mixedNode = {
      fills: [
        { type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.5 },
        {
          type: "IMAGE",
          imageRef: "ref_456",
          scaleMode: "FIT",
          visible: true,
        },
      ],
    };
    expect(nodeHasImageFill(mixedNode as any)).toBe(true);
    expect(getImageFills(mixedNode as any)).toHaveLength(1);
  });
});

describe("isLikelyIcon with image fills", () => {
  it("rejects nodes with image fills even if small or named 'icon'", () => {
    const smallImageRect = {
      id: "1:2",
      name: "icon-user",
      type: "RECTANGLE" as const,
      width: 48,
      height: 48,
      fills: [
        {
          type: "IMAGE",
          imageRef: "ref_123",
          scaleMode: "FILL",
          visible: true,
        },
      ],
    };
    expect(isLikelyIcon(smallImageRect as any)).toBe(false);
  });

  it("rejects container frames if they contain image children", () => {
    const imageChild = {
      id: "1:3",
      name: "avatar-image",
      type: "RECTANGLE" as const,
      width: 40,
      height: 40,
      visible: true,
      fills: [
        {
          type: "IMAGE",
          imageRef: "ref_123",
          scaleMode: "FILL",
          visible: true,
        },
      ],
    };
    const frameWithImage = {
      id: "1:4",
      name: "user-card",
      type: "FRAME" as const,
      width: 48,
      height: 48,
      visible: true,
      children: [imageChild],
      fills: [],
    };
    expect(isLikelyIcon(frameWithImage as any)).toBe(false);
  });

  it("accepts pure vector graphics without image fills", () => {
    const vectorNode = {
      id: "1:5",
      name: "Vector",
      type: "VECTOR" as const,
      width: 24,
      height: 24,
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
    };
    expect(isLikelyIcon(vectorNode as any)).toBe(true);
  });
});

describe("HTML and Tailwind code generation for images", () => {
  const sampleImageNode: any = {
    id: "10:20",
    name: "Hero Photo",
    type: "RECTANGLE",
    width: 320,
    height: 240,
    x: 0,
    y: 0,
    visible: true,
    canBeFlattened: false,
    fills: [
      {
        type: "IMAGE",
        imageRef: "hero_img_ref",
        scaleMode: "FILL",
        visible: true,
      },
    ],
  };

  it("generates <img> element in HTML mode", async () => {
    const output = await htmlMain([sampleImageNode], {
      ...defaultSettings,
      htmlGenerationMode: "html",
    });

    expect(output.html).toContain("<img");
    expect(output.html).toContain('src="images/hero-photo-10-20.png"');
    expect(output.html).toContain('alt="Hero Photo"');
    expect(output.html).not.toContain("<svg");
  });

  it("generates <img /> element in JSX mode", async () => {
    const output = await htmlMain([sampleImageNode], {
      ...defaultSettings,
      htmlGenerationMode: "jsx",
    });

    expect(output.html).toContain("<img");
    expect(output.html).toContain('src="images/hero-photo-10-20.png"');
    expect(output.html).toContain("/>");
    expect(output.html).not.toContain("<svg");
  });

  it("generates <img className=... /> element in Tailwind JSX mode", async () => {
    const code = await tailwindMain([sampleImageNode], {
      ...defaultSettings,
      framework: "Tailwind",
      tailwindGenerationMode: "jsx",
    });

    expect(code).toContain("<img");
    expect(code).toContain('className="');
    expect(code).toContain('src="images/hero-photo-10-20.png"');
    expect(code).toContain('alt="Hero Photo"');
    expect(code).not.toContain("<svg");
  });

  it("generates background-image for image container with children", async () => {
    const containerWithChild: any = {
      id: "20:30",
      name: "Banner Card",
      type: "FRAME",
      width: 400,
      height: 200,
      x: 0,
      y: 0,
      visible: true,
      canBeFlattened: false,
      layoutMode: "NONE",
      fills: [
        {
          type: "IMAGE",
          imageRef: "banner_ref",
          scaleMode: "FILL",
          visible: true,
        },
      ],
      children: [
        {
          id: "20:31",
          name: "Card Title",
          type: "TEXT",
          width: 200,
          height: 30,
          x: 10,
          y: 10,
          visible: true,
          characters: "Hello World",
          styledTextSegments: [
            {
              characters: "Hello World",
              start: 0,
              end: 11,
              fontSize: 16,
              fontName: { family: "Inter", style: "Regular" },
              fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
            },
          ],
        },
      ],
    };

    const htmlOutput = await htmlMain([containerWithChild], {
      ...defaultSettings,
      htmlGenerationMode: "html",
    });

    expect(htmlOutput.html).toContain("background-image: url(images/banner-card-20-30.png)");
    expect(htmlOutput.html).not.toContain("<img");

    const tailwindOutput = await tailwindMain([containerWithChild], {
      ...defaultSettings,
      framework: "Tailwind",
      tailwindGenerationMode: "jsx",
    });

    expect(tailwindOutput).toContain("bg-[url(images/banner-card-20-30.png)]");
  });

  it("generates external <img src='...svg' /> when embedVectors is false", async () => {
    const vectorIconNode: any = {
      id: "50:60",
      name: "Star Icon",
      type: "VECTOR",
      width: 24,
      height: 24,
      x: 0,
      y: 0,
      visible: true,
      canBeFlattened: true,
      fills: [{ type: "SOLID", color: { r: 1, g: 0.8, b: 0 } }],
    };

    const htmlOutput = await htmlMain([vectorIconNode], {
      ...defaultSettings,
      embedVectors: false,
      htmlGenerationMode: "html",
    });

    expect(htmlOutput.html).toContain("<img");
    expect(htmlOutput.html).toContain('src="images/star-icon-50-60.svg"');
    expect(htmlOutput.html).toContain('alt="Star Icon"');
    expect(htmlOutput.html).not.toContain("<svg");

    const tailwindOutput = await tailwindMain([vectorIconNode], {
      ...defaultSettings,
      embedVectors: false,
      framework: "Tailwind",
      tailwindGenerationMode: "jsx",
    });

    expect(tailwindOutput).toContain("<img");
    expect(tailwindOutput).toContain('src="images/star-icon-50-60.svg"');
    expect(tailwindOutput).toContain('alt="Star Icon"');
    expect(tailwindOutput).not.toContain("<svg");
  });

  it("respects customImagePath when configured", async () => {
    const vectorIconNode: any = {
      id: "50:60",
      name: "Star Icon",
      type: "VECTOR",
      width: 24,
      height: 24,
      x: 0,
      y: 0,
      visible: true,
      canBeFlattened: true,
      fills: [{ type: "SOLID", color: { r: 1, g: 0.8, b: 0 } }],
    };

    const htmlOutput = await htmlMain([vectorIconNode, sampleImageNode], {
      ...defaultSettings,
      embedVectors: false,
      customImagePath: "assets/icons/",
      htmlGenerationMode: "html",
    });

    expect(htmlOutput.html).toContain('src="assets/icons/star-icon-50-60.svg"');
    expect(htmlOutput.html).toContain('src="assets/icons/hero-photo-10-20.png"');
  });
});
