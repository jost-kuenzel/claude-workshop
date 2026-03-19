"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const themes = ["system", "light", "dark"] as const;

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  function cycleTheme() {
    const current = themes.indexOf((theme as (typeof themes)[number]) ?? "system");
    const next = themes[(current + 1) % themes.length];
    setTheme(next);
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" disabled aria-label="Toggle theme">
        Theme
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={cycleTheme} aria-label="Toggle theme">
      {theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System"}
    </Button>
  );
}
