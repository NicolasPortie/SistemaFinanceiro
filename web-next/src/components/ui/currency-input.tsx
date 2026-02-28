"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Formats a raw digit string (cents) into BRL display: "12345" → "123,45"
 */
function centsToDisplay(cents: string): string {
  const cleaned = cents.replace(/^0+(?=\d)/, "") || "0";
  const padded = cleaned.padStart(3, "0");
  const intPart = padded.slice(0, -2);
  const decPart = padded.slice(-2);
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots},${decPart}`;
}

/** "123,45" or "1.234,56" → "123,45" or "1234,56" (remove thousand dots only) */
function displayToFormValue(display: string): string {
  return display.replace(/\./g, "");
}

/** Extract raw digits from any string */
function extractDigits(str: string): string {
  return str.replace(/\D/g, "") || "0";
}

export interface CurrencyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "type"
> {
  value: string;
  onValueChange: (value: string) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    const centsRef = React.useRef(extractDigits(value));
    const internalUpdate = React.useRef(false);
    const [, setTick] = React.useReducer((n: number) => n + 1, 0);

    // Sync from external value changes only (form.reset, etc.)
    React.useEffect(() => {
      if (internalUpdate.current) {
        internalUpdate.current = false;
        return;
      }
      centsRef.current = extractDigits(value);
      setTick();
    }, [value]);

    const commit = (newCents: string) => {
      centsRef.current = newCents;
      internalUpdate.current = true;
      onValueChange(displayToFormValue(centsToDisplay(newCents)));
      setTick();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow navigation keys through
      if (["Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
        return;

      e.preventDefault();

      if (e.key === "Backspace") {
        const c = centsRef.current;
        commit(c.length > 1 ? c.slice(0, -1) : "0");
        return;
      }

      if (e.key === "Delete") {
        commit("0");
        return;
      }

      if (/^\d$/.test(e.key)) {
        const c = centsRef.current;
        if (c.replace(/^0+/, "").length >= 11) return;
        commit(c === "0" ? e.key : c + e.key);
      }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const digits = e.clipboardData.getData("text").replace(/\D/g, "");
      if (digits) commit(digits.slice(0, 11));
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={centsToDisplay(centsRef.current)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onChange={() => {}}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
