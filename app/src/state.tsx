import React, { createContext, useContext, useState } from "react";

export interface DemoSettings {
  persona: string;
  today: string;
  saveFirstPct: number;
  introSeen: boolean;
  /** "One promise" (Save More Tomorrow): when on, saveFirstPct is locked to 1%. */
  promiseOn: boolean;
  /** saveFirstPct before the promise was switched on — restored when it goes off. */
  prevSavePct: number;
  setPersona: (p: string) => void;
  setToday: (t: string) => void;
  setSaveFirstPct: (v: number) => void;
  setIntroSeen: (v: boolean) => void;
  setPromiseOn: (v: boolean) => void;
  setPrevSavePct: (v: number) => void;
}

const Ctx = createContext<DemoSettings>({
  persona: "CUST04957",
  today: "2026-09-15",
  saveFirstPct: 0,
  introSeen: false,
  promiseOn: false,
  prevSavePct: 0,
  setPersona: () => {},
  setToday: () => {},
  setSaveFirstPct: () => {},
  setIntroSeen: () => {},
  setPromiseOn: () => {},
  setPrevSavePct: () => {},
});

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = useState(process.env.EXPO_PUBLIC_PERSONA ?? "CUST04957");
  const [today, setToday] = useState("2026-09-15");
  const [saveFirstPct, setSaveFirstPct] = useState(0);
  const [introSeen, setIntroSeen] = useState(false);
  const [promiseOn, setPromiseOn] = useState(false);
  const [prevSavePct, setPrevSavePct] = useState(0);
  return (
    <Ctx.Provider
      value={{
        persona,
        today,
        saveFirstPct,
        introSeen,
        promiseOn,
        prevSavePct,
        setPersona,
        setToday,
        setSaveFirstPct,
        setIntroSeen,
        setPromiseOn,
        setPrevSavePct,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useDemo = () => useContext(Ctx);
