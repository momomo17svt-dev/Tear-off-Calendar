import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, PanResponder, Animated, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useSettingsStore } from '@/store/settingsStore';
import { useEventStore } from '@/store/eventStore';

const dayOfWeekStr = ['日', '月', '火', '水', '木', '金', '土'];

const getBackgroundColor = (theme: string) => {
  switch (theme) {
    case 'corkboard': return '#C89D7C'; 
    case 'wood': return '#6D4C41';      
    case 'light-gray':
    default:
      return '#e8eaed';                 
  }
};

const getDayColor = (dayIndex: number) => {
  if (dayIndex === 0) return '#e63946'; // Sun
  if (dayIndex === 6) return '#1d3557'; // Sat
  return '#111';
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isBgEnabled, bgUri: fixedBgUri, bgUris, bgMode, appTheme } = useSettingsStore();
  const { getEventsForDate } = useEventStore();
  useEventStore((state) => state.events); // to trigger re-render on change

  const [currentDateObj, setCurrentDateObj] = useState(new Date());

  const [prevDateObj, setPrevDateObj] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  });

  const [nextDateObj, setNextDateObj] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });

  const pan = useRef(new Animated.ValueXY()).current;
  const lastDateRef = useRef(currentDateObj);

  useEffect(() => {
    if (lastDateRef.current.getTime() !== currentDateObj.getTime()) {
      // Date has been updated and rendered by React.
      // Now it's safe to reset the pan and update the background cards.
      lastDateRef.current = currentDateObj;
      
      // Reset animations instantly
      pan.setValue({ x: 0, y: 0 });
      
      // Update background cards relative to the new current date
      setNextDateObj(() => {
        const d = new Date(currentDateObj);
        d.setDate(d.getDate() + 1);
        return d;
      });
      setPrevDateObj(() => {
        const d = new Date(currentDateObj);
        d.setDate(d.getDate() - 1);
        return d;
      });
    }
  }, [currentDateObj, pan]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
      },
      onPanResponderMove: Animated.event(
        [null, { dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120) {
          // Tear off -> Next Day
          Animated.timing(pan.y, {
            toValue: 800,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            setCurrentDateObj((prev) => {
              const d = new Date(prev);
              d.setDate(d.getDate() + 1);
              return d;
            });
          });
        } else if (gestureState.dy < -120) {
          // Put back -> Previous Day
          Animated.timing(pan.y, {
            toValue: -800, // fly all the way up to 0 position
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            setCurrentDateObj((prev) => {
              const d = new Date(prev);
              d.setDate(d.getDate() - 1);
              return d;
            });
          });
        } else {
          // Spring back to center
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            bounciness: 10,
          }).start();
        }
      },
    })
  ).current;

  const currentTranslateY = pan.y.interpolate({
    inputRange: [0, 800],
    outputRange: [0, 800],
    extrapolate: 'clamp',
  });

  const currentRotateZ = pan.y.interpolate({
    inputRange: [0, 800],
    outputRange: ['0deg', '15deg'],
    extrapolate: 'clamp',
  });

  const prevTranslateY = pan.y.interpolate({
    inputRange: [-800, 0],
    outputRange: [0, 800],
    extrapolate: 'clamp',
  });

  const prevRotateZ = pan.y.interpolate({
    inputRange: [-800, 0],
    outputRange: ['0deg', '-15deg'],
    extrapolate: 'clamp',
  });

  const getDisplayedBgUri = (dObj: Date) => {
    if (!isBgEnabled || bgUris.length === 0) return null;
    if (bgMode === 'fixed') {
      return fixedBgUri || bgUris[0];
    }
    const seed = dObj.getFullYear() * 10000 + (dObj.getMonth() + 1) * 100 + dObj.getDate();
    return bgUris[seed % bgUris.length];
  };

  const renderCardContent = (dObj: Date) => {
    const y = dObj.getFullYear();
    const mDisplay = dObj.getMonth() + 1;
    const dDisplay = dObj.getDate();
    
    const mStr = String(mDisplay).padStart(2, '0');
    const dStr = String(dDisplay).padStart(2, '0');
    const dateStr = `${y}-${mStr}-${dStr}`;
    const dayStr = dayOfWeekStr[dObj.getDay()];
    const todaysEvents = getEventsForDate(dateStr);
    const bgUri = getDisplayedBgUri(dObj);
    const dayColor = getDayColor(dObj.getDay());

    return (
      <View style={styles.cardInner}>
        <View style={styles.bindingContainer}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <View key={i} style={styles.hole} />
          ))}
        </View>

        {bgUri ? (
          <View style={styles.imageHeader}>
            <Image source={{ uri: bgUri }} style={styles.cardImage} contentFit="cover" />
          </View>
        ) : null}

        <View style={[styles.dateArea, !bgUri && styles.dateAreaLarge]}>
          <ThemedText style={styles.yearMonth}>{`${y}年 ${mDisplay}月`}</ThemedText>
          
          <View style={styles.dateRow}>
            <ThemedText 
              style={[
                styles.day, 
                { 
                  color: dayColor, 
                  fontSize: bgUri ? 60 : 90, 
                  lineHeight: bgUri ? 70 : 100 
                }
              ]}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {dDisplay}
            </ThemedText>
            <ThemedText style={[styles.dayOfWeek, { color: dayColor }]}>({dayStr})</ThemedText>
          </View>

          <View style={styles.divider} />

          <View style={styles.eventsContainer}>
            {todaysEvents.length === 0 ? (
              <ThemedText style={styles.noEventsText}>予定はありません</ThemedText>
            ) : (
              todaysEvents.map((evt) => (
                <View key={evt.id} style={styles.eventRow}>
                  <View style={[styles.eventDot, { backgroundColor: evt.type === 'birthday' ? '#ff6b6b' : '#4ecdc4' }]} />
                  <ThemedText style={styles.eventText} numberOfLines={2}>{evt.title}</ThemedText>
                </View>
              ))
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View 
      style={[styles.container, { backgroundColor: getBackgroundColor(appTheme) }]} 
      {...panResponder.panHandlers}
    >
      <View style={[styles.innerContainer, { paddingTop: insets.top, paddingBottom: insets.bottom + 80 }]}>
        
        {/* Layer 1: Next Card (Behind) */}
        <Animated.View style={[styles.calendarCard, styles.absoluteCard]}>
          {renderCardContent(nextDateObj)}
        </Animated.View>

        {/* Layer 2: Current Card (Middle) - Falls down on swipe down */}
        <Animated.View
          style={[
            styles.calendarCard, 
            styles.absoluteCard,
            { 
              transform: [
                { translateY: currentTranslateY },
                { rotateZ: currentRotateZ }
              ] 
            }
          ]}
        >
          {renderCardContent(currentDateObj)}
        </Animated.View>

        {/* Layer 3: Previous Card (Front) - Comes from bottom on swipe up */}
        <Animated.View
          style={[
            styles.calendarCard, 
            styles.absoluteCard,
            { 
              transform: [
                { translateY: prevTranslateY },
                { rotateZ: prevRotateZ }
              ],
            }
          ]}
          pointerEvents="none" // Ensure it doesn't block touches when invisible
        >
          {renderCardContent(prevDateObj)}
        </Animated.View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCard: {
    width: '88%',
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  absoluteCard: {
    position: 'absolute',
  },
  cardInner: {
    width: '100%',
  },
  bindingContainer: {
    height: 30,
    backgroundColor: '#f8f9fa',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingHorizontal: 20,
  },
  hole: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 1,
    elevation: 2,
  },
  imageHeader: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: '#ddd',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  dateArea: {
    padding: 20,
    alignItems: 'center',
  },
  dateAreaLarge: {
    paddingVertical: 50,
  },
  yearMonth: {
    fontSize: 22,
    fontWeight: '600',
    color: '#555',
    marginBottom: 5,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 10,
  },
  day: {
    fontWeight: 'bold',
  },
  dayOfWeek: {
    fontSize: 24,
    fontWeight: '600',
    marginLeft: 8,
    flexShrink: 1,
  },
  divider: {
    width: '80%',
    height: 2,
    backgroundColor: '#f0f0f0',
    marginVertical: 20,
  },
  eventsContainer: {
    width: '100%',
    alignItems: 'center',
    minHeight: 60,
  },
  noEventsText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    marginBottom: 10,
  },
  eventDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  eventText: {
    fontSize: 18,
    color: '#333',
    flex: 1,
  },
});
