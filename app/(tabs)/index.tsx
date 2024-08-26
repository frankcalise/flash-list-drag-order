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
  useAnimatedStyle,
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

const INITIAL_DATA = Array.from(Array(200), (_, i) => {
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
  const [draggingIndex, setDraggingIndex] = React.useState(-1);
  const [floatingOverIndex, setFloatingOverIndex] = React.useState(-1);
  const [data, setData] = React.useState(INITIAL_DATA);

  // TODO get the list height
  const listHeight = React.useRef(701);

  /**
   * ! Worklets must be defined before they are used, otherwise you will experience a crash.
   */
  const getIndexFromY = React.useCallback(
    (y: number) => {
      "worklet";

      return Math.floor(
        Math.min(
          data.length - 1,
          Math.max(0, Math.floor(y + scrollOffsetY.value) / ROW_HEIGHT)
        )
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
    .maxPointers(1)
    .activateAfterLongPress(300)
    .onStart(({ y, absoluteY }) => {
      // Get item index from the Y position where the gesture started
      const index = getIndexFromY(y);
      console.log("onStart", { index, y, absoluteY });
      runOnJS(setIsDraggingItem)(true);
      runOnJS(setDraggingIndex)(index);
      runOnJS(setFloatingOverIndex)(index);
      dragItemAbsY.value = absoluteY + ROW_HEIGHT / 2;
    })
    .onUpdate(({ absoluteY, y }) => {
      scrollLogic({ absoluteY });
      dragItemAbsY.value = absoluteY + ROW_HEIGHT / 2;

      const index = getIndexFromY(y);
      runOnJS(setFloatingOverIndex)(index);
    })
    .onFinalize(() => {
      runOnJS(setIsDraggingItem)(false);
      runOnJS(setDraggingIndex)(-1);
      runOnJS(setFloatingOverIndex)(-1);

      // update the data array to reflect the new order
      const updatedData = [...data];
      const [removed] = updatedData.splice(draggingIndex, 1);
      // when dragging down, we have to subtract 1 from the floating index
      // but when dragging the item up, just insert it as is
      const directionOffset = floatingOverIndex > draggingIndex ? 1 : 0;
      updatedData.splice(floatingOverIndex - directionOffset, 0, removed);

      runOnJS(setData)(updatedData);
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

  const $floatingItem = useAnimatedStyle(() => {
    return {
      top: dragItemAbsY.value,
    };
  });

  // TODO extract list item into component to use inbetween the floating Animated layer and for the FlashList
  console.log({ draggingIndex, floatingOverIndex });

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      {isDraggingItem && (
        <Animated.View
          style={[
            {
              position: "absolute",
              width: "100%",
              zIndex: 99,
              elevation: 99,
            },
            $floatingItem,
          ]}
        >
          <View
            style={{
              height: ROW_HEIGHT,
              padding: 8,
              backgroundColor: "#f2f2f2",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              opacity: 0.8,
              borderWidth: 5,
              borderColor: "red",
            }}
          >
            <View
              style={{
                justifyContent: "center",
                paddingHorizontal: 16,
              }}
            >
              <ThemedText style={{ fontSize: 12, flex: 1 }}>
                Dragging idx {draggingIndex} (val={data[draggingIndex]})
              </ThemedText>
              <ThemedText style={{ fontSize: 12, flex: 1 }}>
                Float over idx {floatingOverIndex} (val=
                {data[floatingOverIndex]})
              </ThemedText>
            </View>
          </View>
        </Animated.View>
      )}
      <GestureDetector ref={panRef} gesture={panGesture}>
        <AnimatedFlashList
          ref={listRef}
          data={data}
          extraData={{ draggingIndex, floatingOverIndex }}
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
                  // "hide" the item we're dragging in the list, looks like it's missing
                  opacity: draggingIndex === index ? 0 : 1,
                  borderColor: "black",
                  // style border color top when this row item index is one before the floating item
                  borderTopWidth:
                    floatingOverIndex !== -1 && floatingOverIndex === index
                      ? 3
                      : 0,
                }}
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
