# DIGITAL AGENT IN A WEBVIEW

This is a demo React Native app that embeds the Insait Digital Agent within a WebView.  
It serves as a clear example of how to integrate the digital agent in a native mobile app.  
The sample also includes an optional function to forward console logs from the agent for debugging purposes.

**Note:** The main implementation can be found in [`/app/(tabs)/chatbot.tsx`](<./app/(tabs)/chatbot.tsx>).  
The component supports passing a dynamic `userId` to the agent, which can be updated at runtime based on the logged-in user or session.

---

## Environment Variables

Create a `.env` file in the root directory to define the following:

| Variable                | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `EXPO_PUBLIC_AGENT_URL` | The URL of the digital agent to be hosted in the WebView. |
| `EXPO_PUBLIC_HOST_URL`  | Your domain, used for whitelisting and validation.        |

Example:

   ```bash
   EXPO_PUBLIC_AGENT_URL=<<YOUR AGENT URL>>
   EXPO_PUBLIC_HOST_URL=<<YOUR HOST URL>>
   ```

## Getting Started

1. Install dependencies

   ```bash
   npm i --legacy-peer-deps
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## Running the App

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

Note: To test the agent in the WebView, scan the QR code displayed in the terminal using Expo Go (on Android) or the Camera app (on iOS).
