import { useEffect, useRef } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import type { WebView as WebViewType } from 'react-native-webview';

export default function ChatbotScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebViewType>(null);
  const [showWebView, setShowWebView] = useState(false);
  const [url, setUrl] = useState<string>('');
  const [newSession, setNewSession] = useState(false);

  // load from env
  const AGENT_URL = process.env.EXPO_PUBLIC_AGENT_URL; // Set this to your agent URL
  const HOST_URL = process.env.EXPO_PUBLIC_HOST_URL; // Set this to your host URL
  const USER_ID = null; // Can be set to a specific external user ID if needed
  const extraData = JSON.stringify({
    userName: 'User McUserface',
    CatNum: 4,
    CatNames: ['Pitzi', 'Mulaf', 'Stina', 'Sir Purrs-a-lot'],
  });

  useEffect(() => {
    if (newSession) {
      setUrl(
        `${AGENT_URL}?originUrl=${HOST_URL}&isMobile=true&userId=${USER_ID}&isCustomIframeEnabled=true&extraData=${extraData}&newSession=${newSession}`
      );
      setShowWebView(true);
    }
  }, [newSession]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => {
            setNewSession(false);
            setShowWebView((prev) => !prev);
            setUrl(
              `${AGENT_URL}?originUrl=${HOST_URL}&isMobile=true&userId=${USER_ID}&isCustomIframeEnabled=true&extraData=${extraData}&newSession=${newSession}`
            );
          }}
        >
          <Text style={styles.buttonText}>
            {showWebView ? 'Close Chatbot' : 'Open Chatbot'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={async () => {
            console.log('Resetting chatbot session');
            setShowWebView(false);
            setNewSession(true);
          }}
        >
          <Text style={styles.buttonText}>Reset Chatbot</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => {
            setNewSession(false);
            setUrl(
              `${AGENT_URL}?originUrl=${HOST_URL}&isMobile=true&userId=${USER_ID}&isCustomIframeEnabled=true&extraData=${extraData}&newSession=${newSession}`
            );
            router.replace('/');
          }}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.webviewContainer}>
        {showWebView && (
          <WebView
            ref={webViewRef}
            source={{
              uri: url,
            }} // dynamically set URL
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
            onLoadEnd={() => {
              setNewSession(false);
              // Failback in case SESSION_CLEARED is not sent
            }}
            onMessage={(event) => {
              try {
                const message = JSON.parse(event.nativeEvent.data);
                if (message.type === 'SESSION_CLEARED') {
                  console.log('WebView console.info:', ...message.data);
                  setNewSession(false);
                  setShowWebView(true);
                } else {
                  console.log('Message from WebView:', ...message.data);
                }
              } catch (e) {
                // Handle non-JSON messages
                console.log(
                  'Raw message from WebView:',
                  event.nativeEvent.data
                );
              }
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 18,
    marginHorizontal: 2,
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1,
    elevation: 1,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  dangerButton: {
    backgroundColor: '#d9534f',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
  webviewContainer: {
    flex: 1,
    zIndex: 1,
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
    height: '100%',
  },
});
