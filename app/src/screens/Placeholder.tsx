import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.h}>{title}</Text>
      <Text style={styles.sub}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F6F2", padding: 20, paddingTop: 72 },
  h: { fontFamily: "Figtree_700Bold", fontSize: 24, color: "#1F2A24" },
  sub: { fontFamily: "Figtree_500Medium", fontSize: 13, color: "#5C6B62", marginTop: 6 },
});
