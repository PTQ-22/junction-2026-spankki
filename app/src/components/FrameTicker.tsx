import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

/**
 * Invisible 2×2 px view whose opacity animates forever on the native driver.
 * The simulator recorder (`simctl io recordVideo`) only writes frames when the
 * screen changes, which breaks timing on static screens; this keeps the
 * compositor producing frames so demo recordings stay in sync with narration.
 */
export function FrameTicker() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.02, 0.04] });
  return <Animated.View pointerEvents="none" style={[styles.dot, { opacity }]} />;
}

const styles = StyleSheet.create({
  dot: { position: "absolute", left: 0, bottom: 0, width: 2, height: 2, backgroundColor: "#F5F0E6" },
});
