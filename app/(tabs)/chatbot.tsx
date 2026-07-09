import { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Keyboard,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { WebView } from 'react-native-webview';
import type { WebView as WebViewType } from 'react-native-webview';

export default function ChatbotScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebViewType>(null);
  const [showWebView, setShowWebView] = useState(false);
  const [html, setHtml] = useState<string>('');
  const [newSession, setNewSession] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  // The iOS tab bar is position:absolute (see app/(tabs)/_layout.tsx), so it floats
  // over the screen and content renders underneath it. Reserve its height at the
  // bottom so the chat's input + footer sit above the bar instead of behind it.
  const tabBarHeight = useBottomTabBarHeight();

  // Shrink the WebView to the space above the keyboard.
  // The embedded chat runs inside an iframe, where its own visual-viewport keyboard
  // handling is disabled by design, and WKWebView doesn't shrink its viewport for the
  // keyboard — so the native side must size the WebView explicitly. The outer document
  // (height:100%) follows the resize, but the chat's vh/dvh units inside the iframe do
  // NOT recompute on their own — see the reflow-nudge effect below that forces it.
  useEffect(() => {
    if (Platform.OS === 'ios') {
      // keyboardWillChangeFrame fires on show, hide, AND resize — critically when the
      // QuickType predictive/autocorrect bar appears while typing, which makes the
      // keyboard ~44pt taller. Listening only to keyboardWillShow captures the initial
      // height once and goes stale, so the input slides behind the grown keyboard.
      // Derive the truly-occluded height from the keyboard's top edge (screenY) so the
      // reserved space always tracks the current keyboard frame.
      const onFrame = (e: { endCoordinates: { screenY: number } }) => {
        const screenH = Dimensions.get('screen').height;
        setKbHeight(Math.max(0, screenH - e.endCoordinates.screenY));
      };
      const frameSub = Keyboard.addListener('keyboardWillChangeFrame', onFrame);
      const hideSub = Keyboard.addListener('keyboardWillHide', () =>
        setKbHeight(0)
      );
      return () => {
        frameSub.remove();
        hideSub.remove();
      };
    }
    // Android: no predictive-bar resize quirk; the simple show/hide pair is enough.
    const showSub = Keyboard.addListener('keyboardDidShow', (e) =>
      setKbHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Nudge the embedded chat to re-measure whenever the keyboard frame changes.
  // The native side sizes the WebView correctly (its bottom sits exactly on the
  // keyboard), but the chat inside the cross-origin iframe sizes itself with
  // vh/dvh units, and WKWebView does NOT recompute those when we resize the
  // WebView frame. So the chat can stay laid out against the stale (taller,
  // pre-keyboard) viewport, pushing its input bar below the visible area and
  // under the keyboard. Toggling the iframe element's height forces a reflow,
  // which updates the iframe's inner viewport and its vh/dvh units.
  // NOTE: best-effort mitigation — the real fix is for the embed to use
  // height:100% (fill the host-sized iframe) instead of vh/dvh.
  useEffect(() => {
    if (Platform.OS !== 'ios' || !showWebView) return;
    const t = setTimeout(() => {
      webViewRef.current?.injectJavaScript(`
        (function() {
          var f = document.getElementById('insait-chat-frame');
          if (!f) return;
          f.style.height = '99.9%';
          f.getBoundingClientRect(); // force synchronous reflow
          requestAnimationFrame(function() { f.style.height = '100%'; });
        })();
        true;
      `);
    }, 50);
    return () => clearTimeout(t);
  }, [kbHeight, showWebView]);

  // ── Config from env ──────────────────────────────────────────────
  // EXPO_PUBLIC_AGENT_URL: the agent's chat URL, e.g. https://app.insait.io/chat/<agentId>
  //   → we derive the platform origin (for the embed <script> + iframe) and the agent id from it.
  // EXPO_PUBLIC_HOST_URL: YOUR domain, registered in the agent's allowed-domains list.
  //   Used as the WebView document baseUrl so the embed's API calls send Origin: <your domain>,
  //   which the platform validates against the allowlist ("whitelisting and validation").
  const AGENT_URL = process.env.EXPO_PUBLIC_AGENT_URL as string;
  const HOST_URL = process.env.EXPO_PUBLIC_HOST_URL as string;

  const parsed = new URL(AGENT_URL);
  const PLATFORM_ORIGIN = parsed.origin; // e.g. https://app.insait.io
  const AGENT_ID = parsed.pathname.split('/').filter(Boolean).pop() ?? ''; // last path segment

  // Identity / context passed to the agent. This is CONTEXT, not authentication —
  // fill with whatever your app knows about the logged-in user.
  const sessionData = { user: {} as Record<string, unknown> };

  // Build the self-contained HTML document that hosts the "own iframe" embed.
  const buildEmbedHtml = () => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #fff; }
      #insait-chat-frame { width: 100%; height: 100%; border: none; display: block; }
    </style>
  </head>
  <body>
    <!-- 1. The iframe container -->
    <iframe id="insait-chat-frame"></iframe>

    <!-- 2. Connect the chat to the iframe (debug on = verbose console.info logs) -->
    <insait-chat
      agent-id="${AGENT_ID}"
      target-iframe="#insait-chat-frame"
      debug="true"
      session-data='${JSON.stringify(sessionData)}'>
    </insait-chat>

    <!-- 3. Embed loader (served from the platform host) -->
    <script src="${PLATFORM_ORIGIN}/embed/insait-chat.js" async></script>
  </body>
</html>`;

  useEffect(() => {
    if (newSession) {
      setHtml(buildEmbedHtml());
      setShowWebView(true);
    }
  }, [newSession]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => {
            setNewSession(false);
            setShowWebView((prev) => !prev);
            setHtml(buildEmbedHtml());
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
            setHtml(buildEmbedHtml());
            router.replace('/');
          }}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
      <View
        style={[
          styles.webviewContainer,
          // Keyboard open: lift above the keyboard (it already covers the tab bar).
          // Keyboard closed: lift above the floating tab bar.
          { marginBottom: kbHeight > 0 ? kbHeight : tabBarHeight },
        ]}
      >
        {showWebView && html && (
          <WebView
            ref={webViewRef}
            // Load a local HTML doc whose origin is YOUR whitelisted domain (baseUrl).
            // The embedded iframe + its API calls inherit that origin, which the platform
            // validates against the agent's allowed-domains list.
            source={{ html, baseUrl: HOST_URL }}
            originWhitelist={['*']}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            // The document is exactly viewport-sized and the chat scrolls its own
            // message list inside the iframe, so the outer WebView never needs to
            // scroll. Disabling it stops WKWebView's keyboard "scroll-into-view"
            // from lifting the input above the (already shrunk) frame and clipping it.
            scrollEnabled={false}
            // Optional function to forward console logs to expo console for debugging
            injectedJavaScriptBeforeContentLoaded={`
              (function() {
                function send(type, args) {
                  try {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: type,
                      data: args.map(function(a) {
                        try { return typeof a === 'string' ? a : JSON.stringify(a); }
                        catch (e) { return String(a); }
                      })
                    }));
                  } catch (e) {}
                }
                ['info', 'log', 'warn', 'error'].forEach(function(level) {
                  const orig = console[level];
                  console[level] = function() {
                    send(level, Array.prototype.slice.call(arguments));
                    if (orig) orig.apply(console, arguments);
                  };
                });
                // Surface uncaught errors + failed resource loads (e.g. embed script 404/blocked)
                window.addEventListener('error', function(e) {
                  if (e && e.target && e.target.src) {
                    send('error', ['RESOURCE FAILED: ' + e.target.src]);
                  } else {
                    send('error', ['window.onerror: ' + (e && e.message) + ' @ ' + (e && e.filename) + ':' + (e && e.lineno)]);
                  }
                }, true);
                window.addEventListener('unhandledrejection', function(e) {
                  send('error', ['unhandledrejection: ' + (e && e.reason)]);
                });
                send('info', ['Console bridge initialised (info/log/warn/error).']);
              })();
              true;
            `}
            onLoadStart={(e) =>
              console.log('[WebView] loadStart:', e.nativeEvent.url)
            }
            onLoadEnd={(e) => {
              console.log('[WebView] loadEnd:', e.nativeEvent.url);
              setNewSession(false);
              // Failback in case SESSION_CLEARED is not sent
            }}
            onError={(e) =>
              console.log('[WebView] ERROR:', JSON.stringify(e.nativeEvent))
            }
            onHttpError={(e) =>
              console.log(
                '[WebView] HTTP ERROR:',
                e.nativeEvent.statusCode,
                e.nativeEvent.url
              )
            }
            onMessage={(event) => {
              try {
                const message = JSON.parse(event.nativeEvent.data);
                if (message.type === 'SESSION_CLEARED') {
                  console.log('[webview:info]', ...message.data);
                  setNewSession(false);
                  setShowWebView(true);
                } else {
                  console.log(`[webview:${message.type}]`, ...message.data);
                }
              } catch (e) {
                console.log('[webview:raw]', event.nativeEvent.data);
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
    paddingVertical: 12,
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
