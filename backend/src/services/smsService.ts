/**
 * QureFlow Real SMS Dispatch Service
 * Optimized for Indian mobile numbers (+91)
 * Supports Fast2SMS (Free Tier) and 2Factor.in
 */

interface SmsDispatchResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

// In-memory OTP store with 10-minute expiration
interface StoredOtp {
  code: string;
  expiresAt: number;
  phone: string;
}

const otpStore = new Map<string, StoredOtp>();

export const smsService = {
  /**
   * Generates and stores a 6-digit OTP for a phone number
   */
  generateOtp(phone: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(cleanPhone, {
      code: otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      phone: cleanPhone,
    });
    return otp;
  },

  /**
   * Verifies an OTP entered by the user
   */
  verifyOtp(phone: string, inputCode: string): boolean {
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    const stored = otpStore.get(cleanPhone);
    if (!stored) {
      return false;
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(cleanPhone);
      return false;
    }
    if (stored.code === inputCode.trim()) {
      otpStore.delete(cleanPhone);
      return true;
    }
    return false;
  },

  /**
   * Dispatches real SMS to a 10-digit Indian phone number via Fast2SMS or 2Factor
   */
  async sendOtpSms(phoneNumber: string, otp: string): Promise<SmsDispatchResult> {
    const clean10Digit = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
    const fast2smsKey = process.env.FAST2SMS_API_KEY?.trim();
    const twoFactorKey = process.env.TWOFACTOR_API_KEY?.trim();

    // 1. 2Factor.in Integration (Verified active & working)
    if (twoFactorKey && twoFactorKey !== 'YOUR_2FACTOR_API_KEY') {
      try {
        console.log(`[SMS Service] Dispatching real SMS via 2Factor.in to +91${clean10Digit}...`);
        const url = `https://2factor.in/API/V1/${twoFactorKey}/SMS/+91${clean10Digit}/${otp}/`;
        const res = await fetch(url);
        const data: any = await res.json();
        console.log('[SMS Service] 2Factor Response:', data);
        if (data.Status === 'Success') {
          return {
            success: true,
            provider: '2Factor.in',
            messageId: data.Details,
          };
        }
        console.warn('[SMS Service] 2Factor did not return Success:', data);
      } catch (err: any) {
        console.error('[SMS Service] 2Factor error:', err);
      }
    }

    // 2. Fast2SMS Integration
    if (fast2smsKey && fast2smsKey !== 'YOUR_FAST2SMS_API_KEY') {
      try {
        console.log(`[SMS Service] Dispatching real SMS via Fast2SMS to +91${clean10Digit}...`);
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: fast2smsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: otp,
            numbers: clean10Digit,
          }),
        });

        const data: any = await response.json();
        console.log('[SMS Service] Fast2SMS Response:', data);

        if (data.return === true || data.status_code === 200) {
          return {
            success: true,
            provider: 'Fast2SMS',
            messageId: data.request_id || 'sent',
          };
        } else {
          // If OTP route fails (e.g. requires quick route), attempt quick route
          const fallbackRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: {
              authorization: fast2smsKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              route: 'q',
              message: `Your QureFlow verification code is ${otp}. Valid for 10 minutes.`,
              language: 'english',
              numbers: clean10Digit,
            }),
          });
          const fbData: any = await fallbackRes.json();
          if (fbData.return === true) {
            return {
              success: true,
              provider: 'Fast2SMS (Quick Route)',
              messageId: fbData.request_id,
            };
          }
          return {
            success: false,
            provider: 'Fast2SMS',
            error: data.message?.[0] || fbData.message?.[0] || 'Failed to dispatch via Fast2SMS',
          };
        }
      } catch (err: any) {
        console.error('[SMS Service] Fast2SMS error:', err);
        return { success: false, provider: 'Fast2SMS', error: err.message };
      }
    }

    // 3. Fallback: No API key configured yet
    console.log(`\n======================================================`);
    console.log(`[SMS GATEWAY PENDING API KEY]`);
    console.log(`To send genuine live SMS to +91${clean10Digit}, add:`);
    console.log(`FAST2SMS_API_KEY=your_key_here to .env`);
    console.log(`Generated Live OTP: ${otp}`);
    console.log(`======================================================\n`);

    return {
      success: false,
      provider: 'Pending Key',
      error: 'FAST2SMS_API_KEY not configured in .env',
    };
  },
};
