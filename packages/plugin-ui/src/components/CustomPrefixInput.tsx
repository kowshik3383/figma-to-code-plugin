import React, { useState, useRef, useEffect } from "react";
import { HelpCircle, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface FormFieldProps {
  // Common props
  label: string;
  initialValue: string | number;
  onValueChange: (value: string | number) => void;
  placeholder?: string;
  helpText?: string;

  // Validation props
  type?: "text" | "number" | "json";
  min?: number;
  max?: number;
  suffix?: string;

  // For text input validation
  disallowedPattern?: RegExp;
  disallowedMessage?: string;

  // Optional preview (for text inputs)
  showPreview?: boolean;
  previewExamples?: string[];
  previewTransform?: (value: string, example: string) => React.ReactNode;
}

const FormField = React.memo(
  ({
    label,
    initialValue,
    onValueChange,
    placeholder,
    helpText,
    type = "text",
    min,
    max,
    suffix,
    disallowedPattern = /\s/,
    disallowedMessage = "Input cannot contain spaces",
    showPreview = false,
    previewExamples = ["flex"],
    previewTransform,
  }: FormFieldProps) => {
    // Use internal state to manage the input value
    const [inputValue, setInputValue] = useState(String(initialValue));
    const [isFocused, setIsFocused] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Update internal state when initialValue changes (from parent)
    useEffect(() => {
      setInputValue(String(initialValue));
      setHasChanges(false);
      setHasError(false);
      setErrorMessage("");
    }, [initialValue]);

    const validateInput = (value: string): boolean => {
      // Text validation
      if (type === "text") {
        if (disallowedPattern && disallowedPattern.test(value)) {
          setHasError(true);
          setErrorMessage(disallowedMessage);
          return false;
        }
        setHasError(false);
        setErrorMessage("");
        return true;
      }

      // Number validation
      if (type === "number") {
        // Check for non-numeric characters
        if (/[^0-9]/.test(value)) {
          setHasError(true);
          setErrorMessage("Only numbers are allowed");
          return false;
        }

        const numValue = parseInt(value, 10);

        if (isNaN(numValue)) {
          setHasError(true);
          setErrorMessage("Please enter a valid number");
          return false;
        }

        if (min !== undefined && numValue < min) {
          setHasError(true);
          setErrorMessage(`Minimum value is ${min}`);
          return false;
        }

        if (max !== undefined && numValue > max) {
          setHasError(true);
          setErrorMessage(`Maximum value is ${max}`);
          return false;
        }

        setHasError(false);
        setErrorMessage("");
        return true;
      }

      if (type === "json") {
        // Check if the string is empty skip validation
        if (!value.trim()) {
          setHasError(false);
          setErrorMessage("");
          return true;
        }

        try {
          // Try to parse the JSON
          const config = JSON.parse(value);

          // Validate that the config is an object
          if (
            typeof config !== "object" ||
            Array.isArray(config) ||
            config === null
          ) {
            throw new Error("Configuration must be a valid JSON object");
          }

          for (const item in config) {
            if (!Array.isArray(config[item])) {
              throw new Error(
                `Key ${item} is not valid and should be an array`,
              );
            }
            config[item].forEach((val) => {
              if (typeof val !== "string") {
                throw new Error(`Values from Key ${item} should be string`);
              }
            });
          }

          // Additional validation could be added here based on expected structure
          // For example, checking specific properties or types

          // If valid, update the preference
          setHasError(false);
          setErrorMessage("");
          return true;
        } catch (error) {
          // Handle parsing errors
          console.error("Invalid JSON configuration:", error);
          setHasError(true);
          setErrorMessage(`Invalid JSON configuration: ${error}`);
          // You could show an error message to the user here
          // Or reset to default/previous value
          return false;
        }
      }

      return true;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      validateInput(newValue);
      setHasChanges(newValue !== String(initialValue));
    };

    const handleTextareaChange = (
      e: React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      validateInput(newValue);
      setHasChanges(newValue !== String(initialValue));
    };

    const applyChanges = () => {
      if (hasError) return;

      if (type === "number") {
        const numValue = parseInt(inputValue, 10);
        if (!isNaN(numValue)) {
          onValueChange(numValue);
        }
      } else {
        onValueChange(inputValue);
      }

      setHasChanges(false);

      // Show success indicator briefly
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    };

    const handleBlur = () => {
      setIsFocused(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyChanges();
        inputRef.current?.blur();
      }
    };

    const handleTextareaKeyDown = (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
    ) => {
      // Only apply changes on Ctrl+Enter or Command+Enter for textarea
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        applyChanges();
        textareaRef.current?.blur();
      }
    };

    // Default preview transform for text prefixes
    const defaultPreviewTransform = (value: string, example: string) => (
      <div className="flex items-center gap-1.5">
        <div className="py-0.5 px-2 bg-background border border-border rounded-md text-[11px] font-mono shadow-2xs">
          <span className="font-bold text-foreground">{value}</span>
          <span className="text-muted-foreground">{example}</span>
        </div>
        <span className="text-xs text-muted-foreground">→</span>
        <div className="py-0.5 px-2 bg-background border border-border rounded-md text-[11px] font-mono text-foreground shadow-2xs">
          {example}
        </div>
      </div>
    );

    const renderPreview = previewTransform || defaultPreviewTransform;

    return (
      <div className="mt-1 mb-1">
        <div className="flex items-center gap-1.5 mb-1">
          <label className="text-xs font-semibold text-foreground">
            {label}
          </label>

          {helpText && (
            <Tooltip>
              <TooltipTrigger
                render={<span className="inline-flex cursor-help opacity-70 hover:opacity-100" />}
              >
                <HelpCircle className="w-3 h-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-xs">{helpText}</TooltipContent>
            </Tooltip>
          )}

          {showSuccess && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 animate-fade-in-out">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>

        <div className="flex w-full items-start gap-2">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center">
              {type === "json" ? (
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleTextareaChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={handleBlur}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={placeholder}
                  rows={4}
                  className={`p-2 px-2.5 text-xs w-full transition-all focus:outline-hidden rounded-lg font-mono resize-y shadow-2xs
                    ${
                      hasError
                        ? "border border-red-500/50 bg-red-500/5 text-red-600"
                        : isFocused
                          ? "border-foreground/40 ring-2 ring-foreground/10 bg-background text-foreground"
                          : "border border-border bg-background text-foreground hover:border-foreground/30"
                    }`}
                />
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={handleChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className={`p-1.5 px-2.5 text-xs w-full transition-all focus:outline-hidden shadow-2xs ${
                    suffix ? "rounded-l-lg" : "rounded-lg"
                  } ${
                    hasError
                      ? "border border-red-500/50 bg-red-500/5 text-red-600"
                      : isFocused
                        ? "border-foreground/40 ring-2 ring-foreground/10 bg-background text-foreground"
                        : "border border-border bg-background text-foreground hover:border-foreground/30"
                  }`}
                />
              )}

              {suffix && (
                <span
                  className="py-1.5 px-2.5 text-xs font-mono border border-l-0 border-border 
                bg-muted rounded-r-lg text-muted-foreground"
                >
                  {suffix}
                </span>
              )}
            </div>

            {hasError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">{errorMessage}</p>
            )}
          </div>

          {hasChanges && (
            <button
              onClick={applyChanges}
              disabled={hasError}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                hasError
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-foreground text-background hover:bg-foreground/90 active:scale-95"
              }`}
            >
              Done
            </button>
          )}
        </div>

        {showPreview && inputValue && !hasError && (
          <div className="flex flex-col w-full mt-2 rounded-lg bg-muted/50 p-2.5 border border-border/80">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
              Preview{hasChanges ? " (unsaved)" : ""}:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {previewExamples.map((example) => (
                <React.Fragment key={example}>
                  {renderPreview(inputValue, example)}
                </React.Fragment>
              ))}
            </div>

            {hasChanges && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
                Press Enter or click Done to apply changes
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
);

FormField.displayName = "FormField";

export default FormField;
