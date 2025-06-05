import { useRef } from 'react';
import { Image, StyleSheet, SafeAreaView, Button, Linking } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { WebView } from 'react-native-webview';
import type { WebView as WebViewType } from 'react-native-webview';

export default function ChatbotScreen() {
  const webViewRef = useRef<WebViewType>(null);

  // load from env
  const AGENT_URL = process.env.EXPO_PUBLIC_AGENT_URL; // Set this to your agent URL
  const HOST_URL = process.env.EXPO_PUBLIC_HOST_URL; // Set this to your host URL
  const USER_ID = null; // Can be set to a specific external user ID if needed

  // Clear localStorage in the WebView for user session
  function clearWebViewLocalStorage() {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        localStorage.clear();
        true; 
      `);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <WebView
        ref={webViewRef}
        source={{
          uri: `${AGENT_URL}?originUrl=${HOST_URL}&isMobile=true&userId=&isCustomIframeEnabled=true`,
        }}
        style={styles.webview}
        javaScriptEnabled={true}
        // Optional function to forward console logs to expo console for debugging
        injectedJavaScript={`
                    (function() {
            const originalConsoleInfo = console.info;
            console.info = function(...args) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'info', data: args }));
              originalConsoleInfo.apply(console, args);
            };

            // Ensure postMessage functionality remains intact

            const originalPostMessage = window.postMessage;
            window.postMessage = function(message, targetOrigin) {
              window.ReactNativeWebView.postMessage(message);
              
              if (originalPostMessage) {
                originalPostMessage.apply(window, arguments);
              }
            };

            console.info('Console info bridge initialised.');
          })();
          true;
          `}
        onLoad={() => {
          clearWebViewLocalStorage();
        }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'InsaitRequestToServer') {
              // Here postMessage events from the WebView can be handled
              return;
            } else {
              console.log('Message from WebView:', ...message.data);
            }
          } catch (e) {
            // Handle non-JSON messages
            console.log('Raw message from WebView:', event.nativeEvent.data);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 30,
    position: 'absolute',
  },
  webview: {
    flex: 1,
    height: 650,
  },
});
