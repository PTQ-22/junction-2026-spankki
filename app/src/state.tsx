import React, { createContext, useContext, useState } from "react";

export interface DemoSettings {
  persona: string;
  today: string;
  saveFirstPct: number;
  introSeen: boolean;
  setPersona: (p: string) => void;
  setToday: (t: string) => void;
  setSaveFirstPct: (v: number) => void;
  setIntroSeen: (v: boolean) => void;
}

const Ctx = createContext<DemoSettings>({
  persona: "CUST04957",
  today: "2026-09-15",
  saveFirstPct: 0,
  introSeen: false,
  setPersona: () => {},
  setToday: () => {},
  setSaveFirstPct: () => {},
  setIntroSeen: () => {},
});

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = useState(process.env.EXPO_PUBLIC_PERSONA ?? "CUST04957");
  const [today, setToday] = useState("2026-09-15");
  const [saveFirstPct, setSaveFirstPct] = useState(0);
  const [introSeen, setIntroSeen] = useState(false);
  return (
    <Ctx.Provider
      value={{ persona, today, saveFirstPct, introSeen, setPersona, setToday, setSaveFirstPct, setIntroSeen }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useDemo = () => useContext(Ctx);
