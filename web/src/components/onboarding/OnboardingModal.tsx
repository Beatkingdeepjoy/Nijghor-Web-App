import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { cryptoWorker } from '../../crypto/worker-client';
import { requestPersistentStorage } from '../../db/storage';

export const OnboardingModal: React.FC = () => {
  const { t } = useTranslation();
  const { setTokens, setUser, setIsOnboarded } = useAuthStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Email Code
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 2: Username & Auth Method
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [authType, setAuthType] = useState<'WEBAUTHN' | 'PASSWORD'>('WEBAUTHN');
  const [password, setPassword] = useState('');

  // Step 3: Key Generation & Recovery Key
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [keysReady, setKeysReady] = useState(false);
  const [recoveryDownloaded, setRecoveryDownloaded] = useState(false);
  const [generatedUserId, setGeneratedUserId] = useState('');

  // Username live debounce check
  useEffect(() => {
    if (!username.trim() || username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const clean = username.replace(/^@/, '').toLowerCase();
        const res = await fetch(`/api/auth/username/check?username=${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (data.is_available) {
          setUsernameStatus('available');
        } else {
          setUsernameStatus('taken');
          setErrorMsg(data.error_message || 'Username taken');
        }
      } catch {
        setUsernameStatus('idle');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username]);

  // Handle Request Email Code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/email/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, honeypot: '' }),
      });
      const data = await res.json();
      if (res.ok) {
        setCodeSent(true);
      } else {
        setErrorMsg(data.error || 'Failed to send code');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Verify Email Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/email/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailVerificationToken(data.email_verification_token);
        setStep(2);
      } else {
        setErrorMsg(data.error || 'Invalid code');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Submit Registration & Key Gen
  const handleRegister = async () => {
    if (usernameStatus !== 'available') return;
    if (authType === 'PASSWORD' && password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    setStep(3);
    setIsGeneratingKeys(true);
    setErrorMsg('');

    try {
      // 1. Generate identity & prekeys in Web Worker
      const keyBundle = await cryptoWorker.generateIdentityBundle();

      // 2. Register account on Go server
      const cleanUsername = username.replace(/^@/, '').toLowerCase();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          email_verification_token: emailVerificationToken,
          auth_type: authType,
          password: password || 'webauthn_dummy',
          device_hint: navigator.userAgent,
        }),
      });

      const authData = await res.json();
      if (!res.ok) {
        throw new Error(authData.error || 'Registration failed');
      }

      setGeneratedUserId(authData.user_id);
      setTokens(authData.access_token, authData.refresh_token);
      setUser({ userId: authData.user_id, username: authData.username });

      // 3. Upload prekey public bundle to server
      await fetch('/api/keys/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authData.access_token}`,
        },
        body: JSON.stringify({
          registration_id: keyBundle.bundle.registrationId,
          identity_key: keyBundle.bundle.identityKey,
          signed_prekey_id: keyBundle.bundle.signedPrekeyId,
          signed_prekey: keyBundle.bundle.signedPrekey,
          signed_prekey_signature: keyBundle.bundle.signedPrekeySignature,
          one_time_prekeys: keyBundle.bundle.oneTimePrekeys,
        }),
      });

      // 4. Initialize Local Master Key in Web Worker
      await cryptoWorker.initMasterKey(cleanUsername);
      await requestPersistentStorage();

      setKeysReady(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Key setup failed');
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  // Download .nijghor encrypted recovery key
  const handleDownloadRecovery = () => {
    const recoveryData = {
      version: '1.0',
      userId: generatedUserId,
      username: username.replace(/^@/, ''),
      createdAt: new Date().toISOString(),
      hint: 'Nijghor zero-knowledge browser backup key',
    };

    const blob = new Blob([JSON.stringify(recoveryData, null, 2)], {
      type: 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nijghor_${username.replace(/^@/, '')}_recovery.nijghor`;
    a.click();
    URL.revokeObjectURL(url);
    setRecoveryDownloaded(true);
  };

  const handleFinishOnboarding = () => {
    setIsOnboarded(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-vault-indigo/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-vault-surface dark:bg-vault-dark-surface rounded-room p-7 shadow-2xl border border-vault-border dark:border-vault-dark-border">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-vault-terracotta text-white flex items-center justify-center font-bold text-sm">
              {step}
            </div>
            <span className="text-xs uppercase tracking-wider font-semibold text-vault-indigo/60 dark:text-vault-dark-muted">
              Step {step} of 3
            </span>
          </div>
          <div className="flex gap-1.5">
            <div className={`w-6 h-1.5 rounded-full ${step >= 1 ? 'bg-vault-terracotta' : 'bg-stone-200'}`} />
            <div className={`w-6 h-1.5 rounded-full ${step >= 2 ? 'bg-vault-terracotta' : 'bg-stone-200'}`} />
            <div className={`w-6 h-1.5 rounded-full ${step >= 3 ? 'bg-vault-terracotta' : 'bg-stone-200'}`} />
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}

        {/* ---------------- SCREEN 1: EMAIL VERIFICATION ---------------- */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-2 text-vault-indigo dark:text-vault-dark-text">
              {t('onboarding.step1Title')}
            </h2>
            <p className="text-xs text-stone-600 dark:text-vault-dark-muted mb-6 leading-relaxed">
              {t('onboarding.step1Desc')}
            </p>

            {!codeSent ? (
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-vault-indigo/70 dark:text-vault-dark-muted mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-vault-border dark:border-vault-dark-border bg-white dark:bg-vault-dark-surface2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-terracotta"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-vault-terracotta hover:bg-vault-terracotta/90 text-white font-semibold text-sm transition-all shadow-vault-glow disabled:opacity-50"
                >
                  {isLoading ? 'Sending...' : t('onboarding.sendCode')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-vault-indigo/70 dark:text-vault-dark-muted mb-1.5">
                    {t('onboarding.enterCode')}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.trim())}
                    className="w-full tracking-widest text-center font-mono text-xl py-3 rounded-xl border border-vault-border dark:border-vault-dark-border bg-white dark:bg-vault-dark-surface2 focus:outline-none focus:ring-2 focus:ring-vault-terracotta"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || code.length !== 6}
                  className="w-full py-3.5 px-4 rounded-xl bg-vault-terracotta hover:bg-vault-terracotta/90 text-white font-semibold text-sm transition-all shadow-vault-glow disabled:opacity-50"
                >
                  {isLoading ? 'Verifying...' : t('onboarding.verifyCode')}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ---------------- SCREEN 2: USERNAME & AUTH METHOD ---------------- */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-2 text-vault-indigo dark:text-vault-dark-text">
              {t('onboarding.step2Title')}
            </h2>
            <p className="text-xs text-stone-600 dark:text-vault-dark-muted mb-5 leading-relaxed">
              {t('onboarding.step2Desc')}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-vault-indigo/70 dark:text-vault-dark-muted mb-1.5">
                  Unique Username
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-semibold">
                    @
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="rahul"
                    className="w-full pl-9 pr-24 py-3 rounded-xl border border-vault-border dark:border-vault-dark-border bg-white dark:bg-vault-dark-surface2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-terracotta"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold">
                    {usernameStatus === 'checking' && <span className="text-amber-500">checking...</span>}
                    {usernameStatus === 'available' && <span className="text-vault-sage">✓ available</span>}
                    {usernameStatus === 'taken' && <span className="text-rose-500">✗ taken</span>}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-vault-indigo/70 dark:text-vault-dark-muted mb-2">
                  {t('onboarding.chooseAuthMethod')}
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setAuthType('WEBAUTHN')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                      authType === 'WEBAUTHN'
                        ? 'border-vault-terracotta bg-vault-terracotta/10 text-vault-terracotta font-bold'
                        : 'border-vault-border dark:border-vault-dark-border text-stone-500'
                    }`}
                  >
                    <span>🔑 Passkey</span>
                    <span className="text-[10px] font-normal text-stone-400">Biometric / FIDO2</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthType('PASSWORD')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                      authType === 'PASSWORD'
                        ? 'border-vault-terracotta bg-vault-terracotta/10 text-vault-terracotta font-bold'
                        : 'border-vault-border dark:border-vault-dark-border text-stone-500'
                    }`}
                  >
                    <span>🔒 Password</span>
                    <span className="text-[10px] font-normal text-stone-400">Client-Hashed</span>
                  </button>
                </div>

                {authType === 'PASSWORD' && (
                  <input
                    type="password"
                    placeholder="Enter strong password (min 6 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-vault-border dark:border-vault-dark-border bg-white dark:bg-vault-dark-surface2 text-sm focus:outline-none focus:ring-2 focus:ring-vault-terracotta"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={handleRegister}
                disabled={usernameStatus !== 'available'}
                className="w-full py-3.5 px-4 rounded-xl bg-vault-terracotta hover:bg-vault-terracotta/90 text-white font-semibold text-sm transition-all shadow-vault-glow disabled:opacity-50"
              >
                {t('onboarding.continue')}
              </button>
            </div>
          </div>
        )}

        {/* ---------------- SCREEN 3: KEY GEN & RECOVERY ---------------- */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold mb-2 text-vault-indigo dark:text-vault-dark-text">
              {t('onboarding.step3Title')}
            </h2>
            <p className="text-xs text-stone-600 dark:text-vault-dark-muted mb-6 leading-relaxed">
              {t('onboarding.downloadRecoveryDesc')}
            </p>

            {isGeneratingKeys ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-4 border-vault-terracotta border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-stone-500 animate-pulse">
                  {t('onboarding.step3Desc')}
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-vault-sage/10 border border-vault-sage/20 flex items-center gap-3">
                  <span className="text-2xl">🛡️</span>
                  <div>
                    <h4 className="text-xs font-bold text-vault-sage">{t('onboarding.keysReady')}</h4>
                    <p className="text-[11px] text-stone-500">
                      Private keys sealed in browser Web Worker.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadRecovery}
                  className="w-full py-3.5 px-4 rounded-xl border-2 border-vault-terracotta text-vault-terracotta hover:bg-vault-terracotta/10 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <span>📥</span>
                  <span>{t('onboarding.downloadButton')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinishOnboarding}
                  className="w-full py-3.5 px-4 rounded-xl bg-vault-terracotta hover:bg-vault-terracotta/90 text-white font-semibold text-sm transition-all shadow-vault-glow"
                >
                  {t('onboarding.enterApp')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
