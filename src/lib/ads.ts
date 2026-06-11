import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';

/**
 * Initialise mobile ads the way Apple and Google require:
 *
 *  1. Gather UMP / GDPR consent (and show the consent form if one is required).
 *  2. Ask for App Tracking Transparency authorisation (iOS 14+). The IDFA is
 *     only available — and the SKAdNetwork attribution only meaningful — once
 *     the user has been prompted, so this must happen before initialize().
 *  3. Initialise the AdMob SDK.
 *
 * Skipping the ATT prompt while still accessing the IDFA is an automatic
 * App Store rejection (Guideline 5.1.2), so all three steps run on device.
 */
export async function initAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // 1. Consent (UMP). Show the form only if it's both required and available.
    try {
      const consent = await AdMob.requestConsentInfo();
      if (
        consent.isConsentFormAvailable &&
        consent.status === AdmobConsentStatus.REQUIRED
      ) {
        await AdMob.showConsentForm();
      }
    } catch { /* consent unavailable (e.g. simulator) — fall through */ }

    // 2. App Tracking Transparency prompt.
    try {
      const { status } = await AdMob.trackingAuthorizationStatus();
      if (status === 'notDetermined') {
        await AdMob.requestTrackingAuthorization();
      }
    } catch { /* ATT not applicable on this OS version */ }

    // 3. Initialise the SDK.
    await AdMob.initialize();
  } catch {
    /* ignore on devices/simulators where AdMob isn't available */
  }
}
