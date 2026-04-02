import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'
import { getCustomerAccount } from './api'

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Register for push notifications and save the token to customer_accounts.
 * Call this on app startup after auth.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Only works on physical devices
  if (!Device.isDevice) {
    console.log('[push] Not a physical device, skipping')
    return null
  }

  // Check/request permissions
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    console.log('[push] Permission not granted')
    return null
  }

  // iOS-specific channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'MicroGRID',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  // Get the Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: undefined, // Uses app.json's extra.eas.projectId
  })
  const token = tokenData.data
  console.log('[push] Token:', token)

  // Save token to customer_accounts
  const acct = await getCustomerAccount()
  if (acct) {
    await supabase
      .from('customer_accounts')
      .update({ push_token: token })
      .eq('id', acct.id)
  }

  return token
}

/**
 * Listen for notification taps — navigate to the relevant screen.
 */
export function addNotificationResponseListener(
  handler: (notification: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(handler)
}
