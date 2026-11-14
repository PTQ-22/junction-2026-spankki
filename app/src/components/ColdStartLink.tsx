/**
 * ColdStartLink — in Expo Go a cold start via `xcrun simctl openurl
 * exp://host:8081/--/ask?q=…` hands the full URL to Linking.getInitialURL(),
 * but expo-router mounts on "/" with EMPTY params. This replays the launch
 * URL's path + query into the router once, so cold-start deep links behave
 * exactly like warm ones (route, sim/flower/obj/q params, persona…).
 */
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Linking } from "react-native";

/** "exp://host:8081/--/ask?q=x" → "/ask?q=x"; "taimi://ask?q=x" → "/ask?q=x". */
export function routeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const dash = url.indexOf("/--/");
  let rest: string;
  if (dash >= 0) rest = url.slice(dash + 3);
  else {
    const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(.*)$/i.exec(url);
    if (!m) return null;
    rest = m[1];
    if (url.startsWith("exp://")) return null; // bare project URL, no deep link
  }
  if (!rest || rest === "/") return null;
  return rest.startsWith("/") ? rest : `/${rest}`;
}

export function ColdStartLink() {
  const router = useRouter();
  useEffect(() => {
    let live = true;
    Linking.getInitialURL()
      .then((url) => {
        const href = routeFromUrl(url);
        if (!live || !href) return;
        // next tick: let the root navigator finish mounting first
        setTimeout(() => router.replace(href as never), 0);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return null;
}
