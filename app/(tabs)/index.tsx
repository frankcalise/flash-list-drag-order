import { Image, StyleSheet, Platform, View } from "react-native";

import { HelloWave } from "@/components/HelloWave";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";

const colorMap = {};

function getRandomColor() {
  var letters = "0123456789ABCDEF";
  var color = "#";
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const data = Array.from(Array(200), (_, i) => {
  colorMap[i] = getRandomColor();
  return i;
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <FlashList
        data={data}
        renderItem={({ item, index }) => {
          return (
            <View
              style={{
                padding: 16,
                backgroundColor:
                  // state === "dragging" ? "#f2f2f2" : colorMap[ite],
                  colorMap[item],
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                opacity: 1, // state === "placeholder" ? 0 : 1
              }}
              // onLayout={onLayout}
            >
              <ThemedText style={{ fontSize: 24 }}>=</ThemedText>
              <ThemedText
                style={{ fontSize: 18, textAlign: "center", flex: 1 }}
              >
                {item}
              </ThemedText>
            </View>
          );
        }}
        estimatedItemSize={70}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
