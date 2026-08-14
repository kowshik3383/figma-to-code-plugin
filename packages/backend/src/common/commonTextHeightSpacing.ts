export const commonLineHeight = (
  lineHeight: LineHeight | undefined,
  fontSize: number,
): number => {
  if (!lineHeight) return 0;
  switch (lineHeight.unit) {
    case "AUTO":
      return 0;
    case "PIXELS":
      return lineHeight.value;
    case "PERCENT":
      return (fontSize * lineHeight.value) / 100;
  }
};

export const commonLetterSpacing = (
  letterSpacing: LetterSpacing | undefined,
  fontSize: number,
): number => {
  if (!letterSpacing) return 0;
  switch (letterSpacing.unit) {
    case "PIXELS":
      return letterSpacing.value;
    case "PERCENT":
      return (fontSize * letterSpacing.value) / 100;
  }
};
