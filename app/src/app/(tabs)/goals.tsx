import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";

/** Legacy route — "What if" now happens on the Home garden. */
export default function Goals() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category = Array.isArray(params.category) ? params.category[0] : params.category;
  return <Redirect href={{ pathname: "/", params: category ? { sim: "1", category } : { sim: "1" } }} />;
}
