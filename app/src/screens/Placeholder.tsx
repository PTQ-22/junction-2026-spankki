import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { C, FONT } from "../theme";

export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.h}>{title}</Text>
      <Text style={styles.sub}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper, padding: 20, paddingTop: 72 },
  h: { fontFamily: FONT.display, fontSize: 24, color: C.ink },
  sub: { fontFamily: FONT.body, fontSize: 13, color: C.sub, marginTop: 6 },
});
