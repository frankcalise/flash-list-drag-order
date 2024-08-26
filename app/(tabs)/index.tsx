import React from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import {
  Gesture,
  GestureDetector,
  GestureType,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";

/**
 * Things learned:
 * 1. The error handling provided by a native build is much better than the Expo Go client.
 * 2. Worklets must be defined before they are used (doing 1 earlier would have helped realize this sooner)
 * 3. setState is not allowed in a worklet, but you can use runOnJS to call a function that uses setState
 * 4. To use a `GestureDetector` with FlashList, you need to pass a ref of the detector to
 *     the `simultaneousHandlers` prop to the FlashList via `overrideProps`
 */

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList<number>);

const colorMap: Record<number, string> = {};
const ROW_HEIGHT = 70;
const SCROLL_THRESHOLD = 100;

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
  // TODO convert from GestureDetector to PanGestureHandler
  const panRef = React.createRef<GestureType>();
  const listRef = useAnimatedRef<FlashList<number>>();
  const scrollOffsetY = useSharedValue(0);
  const dragItemAbsY = useSharedValue(0);
  const [isDraggingItem, setIsDraggingItem] = React.useState(false);

  // TODO get the list height
  const listHeight = React.useRef(701);

  /**
   * ! Worklets must be defined before they are used, otherwise you will experience a crash.
   */
  const getIndexFromY = React.useCallback(
    (y: number) => {
      "worklet";

      return Math.min(
        data.length - 1,
        // TODO maybe take the tab bar into account here?
        Math.max(0, Math.floor(y + scrollOffsetY.value) / ROW_HEIGHT)
      );
    },
    [data, scrollOffsetY, insets]
  );

  const scrollLogic = React.useCallback(
    ({ absoluteY }: { absoluteY: number }) => {
      "worklet";
      const lowerBound = 1.5 * ROW_HEIGHT;
      const upperBound = scrollOffsetY.value + listHeight.current;

      // scroll speed is proportional to the item height (the bigger the item, the faster it scrolls)
      const scrollSpeed = ROW_HEIGHT * 0.8;

      if (absoluteY <= lowerBound) {
        // while scrolling to the top of the list
        const nextPosition = scrollOffsetY.value - scrollSpeed;
        scrollTo(listRef, 0, Math.max(nextPosition, 0), false);
      } else if (absoluteY + scrollOffsetY.value >= upperBound) {
        // while scrolling to the bottom of the list
        const nextPosition = scrollOffsetY.value + scrollSpeed;
        scrollTo(listRef, 0, Math.max(nextPosition, 0), false);
      }
    },
    [scrollOffsetY, listRef]
  );

  /**
   * This gesture will run on a native thread, if you try to access JS code, such as setState, it will crash.
   * Thanks Hirbod - https://github.com/software-mansion/react-native-gesture-handler/discussions/2061#discussioncomment-2794942
   */
  const panGesture = Gesture.Pan()
    // .runOnJS(true)
    .maxPointers(1)
    .activateAfterLongPress(300)
    .onStart(({ y, absoluteY }) => {
      // Get item index from the Y position where the gesture started
      const index = getIndexFromY(y);
      console.log("onStart", { index, y });
      runOnJS(setIsDraggingItem)(true);
      dragItemAbsY.value = absoluteY;
    })
    .onUpdate(({ absoluteY, y }) => {
      scrollLogic({ absoluteY });
      dragItemAbsY.value = absoluteY;

      // Also begin updating the index for the dragged item
    })
    .onFinalize(({ translationX, translationY }) => {
      runOnJS(setIsDraggingItem)(false);
      // console.log("onFinalize", { translationX, translationY });
    });

  /**
   * Ran into `useAnimatedScrollHandler` not working with the version that ships with Expo Go
   * https://github.com/software-mansion/react-native-reanimated/issues/5941
   */
  const onScroll = useAnimatedScrollHandler({
    onScroll: ({ contentOffset: { y } }) => {
      console.log("onscroll", y);
      scrollOffsetY.value = y;
    },
  });

  // TODO extract list item into component to use inbetween the floating Animated layer and for the FlashList

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      {isDraggingItem && (
        <Animated.View
          style={{
            top: dragItemAbsY,
            position: "absolute",
            width: "100%",
            zIndex: 99,
            elevation: 99,
          }}
        >
          <View
            style={{
              height: ROW_HEIGHT,
              padding: 16,
              backgroundColor: "#f2f2f2",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              opacity: 1, // state === "placeholder" ? 0 : 1
            }}
            // onLayout={onLayout}
          >
            <ThemedText style={{ fontSize: 24 }}>=</ThemedText>
            <ThemedText style={{ fontSize: 18, textAlign: "center", flex: 1 }}>
              item idx here
            </ThemedText>
          </View>
          {/* {this.props.renderRow(
            dataProvider.getDataForIndex(draggingIdx),
            draggingIdx,
            "dragging",
            this.props.renderDragHandle()
          )} */}
        </Animated.View>
      )}
      <GestureDetector ref={panRef} gesture={panGesture}>
        <AnimatedFlashList
          ref={listRef}
          data={data}
          // Thanks Jakub - https://github.com/software-mansion/react-native-gesture-handler/issues/2175#issuecomment-1230207219
          overrideProps={{
            simultaneousHandlers: panRef,
          }}
          // store scroll offset
          onScroll={onScroll}
          renderItem={({ item, index }) => {
            return (
              <View
                style={{
                  height: ROW_HEIGHT,
                  padding: 16,
                  backgroundColor: colorMap[item],
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
          estimatedItemSize={ROW_HEIGHT}
        />
      </GestureDetector>
    </View>
  );
}
