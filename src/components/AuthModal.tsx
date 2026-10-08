import React, { useState, useRef, useEffect } from 'react';
import { authService, UserProfile } from '../persistence/authService';
import {
  User,
  LogIn,
  UserPlus,
  Lock,
  Mail,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  X,
  KeyRound,
  RotateCw,
  Eye,
  EyeOff,
  ArrowLeft,
  Send,
  LogOut,
  Loader2,
  Sparkles,
  Check,
  Smartphone,
} from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentProfile: UserProfile | null;
  onSuccess?: () => void;
  initialTab?: 'signin' | 'signup' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentProfile,
  onSuccess,
  initialTab = 'signin',
}) => {
  const { language } = useI18n();

  // Mode: if currentUser is logged in and not switching, show 'profile', else 'form'
  const [viewMode, setViewMode] = useState<'profile' | 'form'>('form');

  // Tab: 'signin' | 'signup'
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');

  // Multi-step flow: 'credentials' -> 'otp'
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');

  // Input fields (Email-only authentication)
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup fields: password confirmation
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password flow via Email OTP (6 digits)
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<'input' | 'otp_reset'>('input');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtpDigits, setForgotOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const forgotDigitInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmNewPassword, setForgotConfirmNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  // OTP Verification State (only shown after submitting credentials)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [cooldown, setCooldown] = useState<number>(0);
  const cooldownTimerRef = useRef<any>(null);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Live Email Verification State
  const [emailCheck, setEmailCheck] = useState<{
    checking: boolean;
    status: 'idle' | 'valid' | 'invalid_format' | 'not_found' | 'already_registered' | 'not_registered';
    message: string;
  }>({
    checking: false,
    status: 'idle',
    message: '',
  });

  // Debounced real-time email existence check
  useEffect(() => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || cleanEmail.length < 5 || !cleanEmail.includes('@')) {
      setEmailCheck({ checking: false, status: 'idle', message: '' });
      return;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(cleanEmail)) {
      setEmailCheck({
        checking: false,
        status: 'invalid_format',
        message: language === 'vi' ? 'Định dạng email chưa đúng chuẩn (Ví dụ: name@gmail.com)' : 'Invalid email format',
      });
      return;
    }

    const timer = setTimeout(async () => {
      setEmailCheck((prev) => ({ ...prev, checking: true }));
      try {
        const res = await authService.checkEmailStatus(cleanEmail, authTab);
        if (!res.validFormat) {
          setEmailCheck({
            checking: false,
            status: 'invalid_format',
            message: res.message || (language === 'vi' ? 'Định dạng email không hợp lệ.' : 'Invalid email format.'),
          });
        } else if (res.existsOnInternet === false) {
          setEmailCheck({
            checking: false,
            status: 'not_found',
            message: res.message || (language === 'vi' ? 'Tên miền hoặc hộp thư này không tồn tại trên Internet.' : 'Email domain does not exist.'),
          });
        } else if (authTab === 'signup' && res.registered) {
          setEmailCheck({
            checking: false,
            status: 'already_registered',
            message: language === 'vi' ? 'Email này đã được đăng ký tài khoản trên hệ thống.' : 'Email is already registered.',
          });
        } else if (authTab === 'signin' && !res.registered) {
          setEmailCheck({
            checking: false,
            status: 'not_registered',
            message: language === 'vi' ? 'Email này chưa được đăng ký tài khoản.' : 'Email is not registered yet.',
          });
        } else {
          setEmailCheck({
            checking: false,
            status: 'valid',
            message: language === 'vi'
              ? (authTab === 'signup' ? 'Định dạng & máy chủ email hợp lệ (mã OTP sẽ gửi về hộp thư này)' : 'Tài khoản hợp lệ')
              : 'Email format & server valid',
          });
        }
      } catch {
        setEmailCheck({ checking: false, status: 'idle', message: '' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [email, authTab, language]);

  // Reset or clear transient feedback when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (currentUser) {
        setViewMode('profile');
      } else {
        setViewMode('form');
        setStep('credentials');
        if (initialTab === 'forgot') {
          setIsForgotPassword(true);
          setForgotStep('input');
        } else {
          setIsForgotPassword(false);
          setForgotStep('input');
          if (initialTab === 'signup') {
            setAuthTab('signup');
          } else if (initialTab === 'signin') {
            setAuthTab('signin');
          }
        }
        setConfirmPassword('');
        setForgotNewPassword('');
        setForgotConfirmNewPassword('');
      }
      setErrorMessage(null);
      setSuccessMessage(null);
      setEmailCheck({ checking: false, status: 'idle', message: '' });
    }
  }, [isOpen, currentUser, initialTab]);

  // Cooldown countdown timer for resending OTP
  useEffect(() => {
    if (cooldown > 0) {
      cooldownTimerRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [cooldown]);

  // Auto focus first OTP digit box when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 120);
    }
  }, [step]);

  // Auto focus first digit for forgot password OTP step
  useEffect(() => {
    if (isForgotPassword && forgotStep === 'otp_reset') {
      setTimeout(() => {
        forgotDigitInputRefs.current[0]?.focus();
      }, 120);
    }
  }, [isForgotPassword, forgotStep]);

  // --- Real-time Delivery Status Watcher ---
  useEffect(() => {
    if (!isOpen || step !== 'otp' || !email.trim()) return;

    let cancelled = false;
    const cleanEmail = email.trim().toLowerCase();

    const checkBounce = async () => {
      try {
        const result = await authService.checkDeliveryStatus(cleanEmail);
        if (!cancelled && result.bounced) {
          setStep('credentials');
          setErrorMessage(
            result.message ||
              (language === 'vi'
                ? 'Hộp thư gửi nhận được thông báo: Địa chỉ email này không tồn tại trên thực tế. Vui lòng kiểm tra lại email.'
                : 'Email address does not exist on mail server. Please enter a valid email.')
          );
          setEmailCheck({
            checking: false,
            status: 'not_found',
            message: language === 'vi' ? 'Email không tồn tại trên hệ thống máy chủ thư' : 'Email does not exist',
          });
        }
      } catch {}
    };

    const timer1 = setTimeout(checkBounce, 2500);
    const timer2 = setTimeout(checkBounce, 5500);

    return () => {
      cancelled = true;
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOpen, step, email, language]);

  if (!isOpen) return null;

  // --- STEP 1: Handle User Submission -> Trigger OTP Dispatch ---
  const handleStartAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage(language === 'vi' ? 'Vui lòng nhập địa chỉ email của bạn.' : 'Please enter your email address.');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage(
        language === 'vi'
          ? 'Địa chỉ email không tồn tại hoặc không đúng định dạng. Vui lòng kiểm tra lại.'
          : 'Invalid email address format. Please check again.'
      );
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage(
        language === 'vi'
          ? 'Vui lòng nhập mật khẩu (tối thiểu 6 ký tự).'
          : 'Password must be at least 6 characters.'
      );
      return;
    }

    if (authTab === 'signup') {
      if (!fullName.trim()) {
        setErrorMessage(language === 'vi' ? 'Vui lòng nhập họ và tên của bạn.' : 'Please enter your full name.');
        return;
      }
      if (!confirmPassword) {
        setErrorMessage(language === 'vi' ? 'Ở bước đăng ký, bắt buộc phải nhập mật khẩu 2 lần để kiểm tra độ tương thích.' : 'Password confirmation is required.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage(
          language === 'vi'
            ? 'Hai mật khẩu không tương thích (không trùng khớp). Vui lòng kiểm tra và nhập lại.'
            : 'Passwords do not match. Please verify again.'
        );
        return;
      }
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Authoritative check on server
    const emailStatus = await authService.checkEmailStatus(cleanEmail, authTab);
    if (!emailStatus.success) {
      setLoading(false);
      const errText = emailStatus.message || (language === 'vi' ? 'Email không hợp lệ hoặc đã được sử dụng.' : 'Invalid or already used email address.');
      setErrorMessage(errText);

      if (authTab === 'signup' && emailStatus.registered) {
        setEmailCheck({
          checking: false,
          status: 'already_registered',
          message: errText,
        });
      } else if (authTab === 'signin' && !emailStatus.registered) {
        setEmailCheck({
          checking: false,
          status: 'not_registered',
          message: errText,
        });
      }
      return;
    }

    // 2. Request 6-digit OTP dispatched to user's real email
    const res = await authService.sendEmailOtp(cleanEmail, fullName.trim(), authTab, password);
    setLoading(false);

    if (!res.success) {
      const errText = res.message || (language === 'vi' ? 'Không thể gửi mã xác nhận OTP.' : 'Failed to send OTP code.');
      setErrorMessage(errText);

      if (errText.includes('đã được đăng ký') || errText.includes('already registered')) {
        setEmailCheck({
          checking: false,
          status: 'already_registered',
          message: errText,
        });
      } else if (errText.includes('chưa được đăng ký') || errText.includes('not registered')) {
        setEmailCheck({
          checking: false,
          status: 'not_registered',
          message: errText,
        });
      } else if (errText.includes('không tồn tại') || errText.includes('does not exist')) {
        setEmailCheck({
          checking: false,
          status: 'not_found',
          message: errText,
        });
      }
      if (res.cooldownSeconds) setCooldown(res.cooldownSeconds);
      return;
    }

    // Advance to Step 2: OTP Verification
    setStep('otp');
    setOtpDigits(['', '', '', '', '', '']);
    setCooldown(res.cooldownSeconds || 60);

    setSuccessMessage(
      language === 'vi'
        ? 'Đã gửi mã OTP vào email của bạn'
        : 'OTP code has been sent to your email'
    );
  };

  // --- Resend OTP ---
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const res = await authService.sendEmailOtp(cleanEmail, fullName.trim(), authTab, password);
    setLoading(false);

    if (!res.success) {
      setStep('credentials');
      const errText = res.message || (language === 'vi' ? 'Lỗi gửi lại mã.' : 'Failed to resend code.');
      setErrorMessage(errText);

      if (errText.includes('không tồn tại') || errText.includes('does not exist')) {
        setEmailCheck({
          checking: false,
          status: 'not_found',
          message: errText,
        });
      }
      if (res.cooldownSeconds) setCooldown(res.cooldownSeconds);
      return;
    }

    setCooldown(res.cooldownSeconds || 60);
    setSuccessMessage(
      language === 'vi'
        ? 'Đã gửi mã OTP vào email của bạn'
        : 'OTP code has been sent to your email'
    );
  };

  // --- STEP 2: Verify 6-digit OTP & Complete Login/Registration ---
  const handleVerifyOtp = async (codeOverride?: string) => {
    const fullCode = codeOverride || otpDigits.join('').trim();
    if (fullCode.length !== 6) {
      setErrorMessage(language === 'vi' ? 'Vui lòng nhập đủ 6 chữ số mã xác nhận.' : 'Please enter all 6 digits of the code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await authService.verifyEmailOtp(
      email.trim(),
      fullCode,
      authTab,
      password,
      fullName.trim()
    );
    if (!res.success) {
      setLoading(false);
      setErrorMessage(res.message || (language === 'vi' ? 'Mã xác nhận không đúng hoặc đã hết hạn.' : 'Invalid or expired code.'));
      return;
    }

    if (authTab === 'signup') {
      try {
        await authService.signUp(email.trim(), password, fullName.trim());
      } catch (err) {
        // Handled through local verified session
      }
    } else {
      try {
        await authService.signIn(email.trim(), password);
      } catch (err) {
        // Fallback to verified OTP profile
      }
    }

    setLoading(false);
    setSuccessMessage(
      language === 'vi'
        ? (authTab === 'signup' ? 'Đăng ký & xác thực tài khoản thành công!' : 'Đăng nhập thành công!')
        : 'Authenticated successfully! Redirecting...'
    );

    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 700);
  };

  // --- Forgot Password Handlers ---
  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setLoading(false);
      setErrorMessage(language === 'vi' ? 'Vui lòng nhập địa chỉ email để nhận mã xác thực OTP.' : 'Please enter your email to receive OTP.');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(cleanEmail)) {
      setLoading(false);
      setErrorMessage(language === 'vi' ? 'Địa chỉ email không đúng định dạng. Vui lòng kiểm tra lại.' : 'Invalid email address format.');
      return;
    }

    const res = await authService.sendForgotPasswordEmailOtp(cleanEmail);
    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.message || (language === 'vi' ? 'Không thể gửi mã OTP tới địa chỉ email này.' : 'Failed to send OTP to email.'));
      return;
    }

    setForgotStep('otp_reset');
    setForgotOtpDigits(['', '', '', '', '', '']);
    setCooldown(res.cooldownSeconds || 60);

    setSuccessMessage(
      language === 'vi'
        ? 'Đã gửi mã OTP vào email của bạn'
        : 'OTP code has been sent to your email'
    );
  };

  const handleResendForgotOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setErrorMessage(null);

    const cleanEmail = forgotEmail.trim().toLowerCase();
    const res = await authService.sendForgotPasswordEmailOtp(cleanEmail);
    setLoading(false);
    if (!res.success) {
      setErrorMessage(res.message || (language === 'vi' ? 'Lỗi gửi lại mã OTP.' : 'Failed to resend code.'));
      return;
    }
    setCooldown(res.cooldownSeconds || 60);
    setSuccessMessage(language === 'vi' ? 'Đã gửi mã OTP vào email của bạn' : 'OTP code has been sent to your email');
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = forgotOtpDigits.join('').trim();
    if (fullCode.length !== 6) {
      setErrorMessage(language === 'vi' ? 'Vui lòng nhập đủ 6 chữ số mã xác thực OTP.' : 'Please enter all 6 OTP digits.');
      return;
    }

    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setErrorMessage(language === 'vi' ? 'Mật khẩu mới phải có tối thiểu 6 ký tự.' : 'New password must have at least 6 characters.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmNewPassword) {
      setErrorMessage(language === 'vi' ? 'Hai mật khẩu không tương thích (chưa trùng khớp). Vui lòng kiểm tra lại!' : 'Passwords do not match!');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await authService.resetPasswordWithEmailOtp({
      email: forgotEmail.trim().toLowerCase(),
      code: fullCode,
      newPassword: forgotNewPassword,
      confirmPassword: forgotConfirmNewPassword,
    });

    setLoading(false);
    if (!res.success) {
      setErrorMessage(res.message || (language === 'vi' ? 'Đặt lại mật khẩu không thành công. Vui lòng kiểm tra mã OTP.' : 'Failed to reset password.'));
      return;
    }

    setSuccessMessage(
      language === 'vi'
        ? 'Khôi phục và đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bằng mật khẩu mới.'
        : 'Password restored successfully! You can now sign in with your new password.'
    );

    setPassword(forgotNewPassword);
    if (forgotEmail.trim()) {
      setEmail(forgotEmail.trim().toLowerCase());
    }

    setTimeout(() => {
      setIsForgotPassword(false);
      setForgotStep('input');
      setAuthTab('signin');
      setSuccessMessage(language === 'vi' ? 'Mật khẩu đã được cập nhật thành công! Vui lòng nhấn Đăng nhập để tiếp tục.' : 'Password updated! Please sign in.');
    }, 1500);
  };

  // Keyboard navigation across the 6 boxes for Main OTP
  const handleDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }

    const char = cleanVal.slice(-1);
    const next = [...otpDigits];
    next[index] = char;
    setOtpDigits(next);

    if (index < 5 && char) {
      digitInputRefs.current[index + 1]?.focus();
    }

    if (index === 5 && char) {
      const completeCode = next.join('');
      if (completeCode.length === 6) {
        handleVerifyOtp(completeCode);
      }
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        digitInputRefs.current[index - 1]?.focus();
        const next = [...otpDigits];
        next[index - 1] = '';
        setOtpDigits(next);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setOtpDigits(next);

    const targetIdx = Math.min(pasted.length, 5);
    digitInputRefs.current[targetIdx]?.focus();

    if (pasted.length === 6) {
      handleVerifyOtp(pasted);
    }
  };

  // Keyboard navigation for Forgot OTP
  const handleForgotDigitChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = [...forgotOtpDigits];
    next[index] = char;
    setForgotOtpDigits(next);

    if (char && index < 5) {
      forgotDigitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleForgotDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!forgotOtpDigits[index] && index > 0) {
        forgotDigitInputRefs.current[index - 1]?.focus();
        const next = [...forgotOtpDigits];
        next[index - 1] = '';
        setForgotOtpDigits(next);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      forgotDigitInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      forgotDigitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleForgotDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...forgotOtpDigits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setForgotOtpDigits(next);
    const targetIdx = Math.min(pasted.length, 5);
    forgotDigitInputRefs.current[targetIdx]?.focus();
  };

  const handleSignOut = async () => {
    setLoading(true);
    await authService.signOut();
    setLoading(false);
    setViewMode('form');
    setStep('credentials');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-y-auto">
      {/* 3D Elevated Card matching System Frame (PaymentModal, Membership 3D, and Tech Panel) */}
      <div
        className="
          relative w-full max-w-lg rounded-3xl overflow-hidden flex flex-col my-auto
          transition-all duration-300
          bg-gradient-to-b from-[#f8fafc] via-white to-[#f0f9ff] text-slate-800
          border border-cyan-400/60
          shadow-[0_20px_60px_rgba(6,182,212,0.18),_inset_0_1px_1px_rgba(255,255,255,0.95)]
          dark:bg-gradient-to-b dark:from-[#0b1c30] dark:via-[#091829] dark:to-[#071322] dark:text-slate-100
          dark:border-cyan-500/50
          dark:shadow-[0_0_50px_rgba(6,182,212,0.25),_0_24px_70px_rgba(0,0,0,0.7),_inset_0_1px_1px_rgba(255,255,255,0.12)]
        "
      >
        {/* Subtle Top Ambient Glowing Line */}
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-90 shadow-[0_0_12px_rgba(6,182,212,0.8)] z-10" />

        {/* Ambient Top Glow Diffuser */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-36 bg-cyan-500/15 dark:bg-cyan-400/20 blur-3xl pointer-events-none" />

        {/* High-tech Circuit Traces Texture */}
        <div className="circuit-traces-overlay absolute inset-0 opacity-[0.05] dark:opacity-[0.12] pointer-events-none" />

        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-cyan-200/60 dark:border-cyan-900/60 bg-white/70 dark:bg-[#081525]/70 backdrop-blur-md flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm border shrink-0 transition-colors ${
                isForgotPassword
                  ? 'bg-gradient-to-br from-amber-400/20 to-orange-500/20 border-amber-400/40 text-amber-600 dark:text-amber-400'
                  : 'bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border-cyan-400/40 text-cyan-600 dark:text-cyan-400'
              }`}
            >
              {isForgotPassword ? (
                <KeyRound className="w-5 h-5 stroke-[2.2]" />
              ) : step === 'otp' ? (
                <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <Sparkles className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                  CircuitCraft <span className="text-cyan-500">3D</span>
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                    isForgotPassword
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border-cyan-300/60 dark:border-cyan-500/40'
                  }`}
                >
                  {isForgotPassword
                    ? (language === 'vi' ? 'Khôi phục (OTP)' : 'Password Reset')
                    : viewMode === 'profile'
                    ? (language === 'vi' ? 'Tài khoản' : 'Account')
                    : step === 'otp'
                    ? (language === 'vi' ? 'Xác thực OTP' : 'Verify OTP')
                    : authTab === 'signin'
                    ? (language === 'vi' ? 'Đăng nhập' : 'Sign In')
                    : (language === 'vi' ? 'Đăng ký' : 'Sign Up')}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                {isForgotPassword
                  ? (language === 'vi'
                      ? 'Khôi phục tài khoản qua mã OTP gửi về email'
                      : 'Reset password via 6-digit OTP code')
                  : viewMode === 'profile'
                  ? (language === 'vi' ? 'Thông tin phiên làm việc hiện tại' : 'Active session profile')
                  : step === 'otp'
                  ? (language === 'vi'
                      ? 'Nhập mã 6 chữ số đã gửi về email của bạn'
                      : 'Enter 6-digit verification code sent to your email')
                  : authTab === 'signin'
                  ? (language === 'vi'
                      ? 'Đăng nhập vào hệ thống mô phỏng & lưu trữ mạch 3D'
                      : 'Sign in to access your 3D circuits and labs')
                  : (language === 'vi'
                      ? 'Tạo tài khoản mới để bắt đầu thiết kế & học tập'
                      : 'Create an account to start designing & learning')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition cursor-pointer"
            title={language === 'vi' ? 'Đóng' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 relative z-10 max-h-[82vh]">
          {/* ================= VIEW: LOGGED IN USER PROFILE ================= */}
          {viewMode === 'profile' && currentUser && (
            <div className="space-y-5 animate-in fade-in">
              <div className="p-5 rounded-2xl tech-card-nested border border-cyan-200/70 dark:border-cyan-900/50 space-y-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-cyan-500/20 border-2 border-white dark:border-slate-800">
                    {(currentProfile?.fullName || currentUser.name || currentUser.email || 'U')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                        {currentProfile?.fullName || currentUser.name || 'Kỹ sư CircuitCraft'}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                        {currentUser.tier?.toUpperCase() || 'PRO'}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400 truncate mt-0.5 font-medium">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{language === 'vi' ? 'Tài khoản đã xác thực bảo mật qua Email OTP' : 'Verified via Email OTP'}</span>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('form');
                    setStep('credentials');
                  }}
                  className="tech-btn-secondary w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <User className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>{language === 'vi' ? 'Đăng nhập tài khoản khác' : 'Switch Account'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="tech-btn-3d-rose w-full py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{language === 'vi' ? 'Đăng xuất khỏi hệ thống' : 'Sign Out'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= VIEW: AUTH FORM ================= */}
          {viewMode === 'form' && (
            <>
              {/* ================= QUÊN MẬT KHẨU FLOW ================= */}
              {isForgotPassword ? (
                <div className="space-y-4 animate-in fade-in">
                  {/* Top Navigation & Step Indicator */}
                  <div className="flex items-center justify-between pb-3 border-b border-cyan-200/50 dark:border-cyan-900/50">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setForgotStep('input');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="tech-btn-secondary px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{language === 'vi' ? 'Quay lại Đăng nhập' : 'Back to Sign In'}</span>
                    </button>

                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                      <KeyRound className="w-3 h-3 text-amber-500" />
                      <span>
                        {forgotStep === 'input'
                          ? (language === 'vi' ? 'Bước 1: Gửi mã OTP' : 'Step 1: Send OTP')
                          : (language === 'vi' ? 'Bước 2: Nhập OTP & Đặt lại mật khẩu' : 'Step 2: Reset Password')}
                      </span>
                    </div>
                  </div>

                  {/* Status Alerts */}
                  {errorMessage && (
                    <div className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/50 border border-rose-300/80 dark:border-rose-800/80 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5 shadow-sm animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed font-medium">{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-300/80 dark:border-emerald-800/80 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5 shadow-sm animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed font-medium">{successMessage}</span>
                    </div>
                  )}

                  {/* QUÊN MẬT KHẨU - BƯỚC 1: NHẬP EMAIL */}
                  {forgotStep === 'input' && (
                    <form onSubmit={handleSendForgotOtp} className="space-y-4">
                      <div className="p-4 rounded-2xl tech-card-nested border border-cyan-200/70 dark:border-cyan-900/50 space-y-1.5">
                        <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-300 font-extrabold text-xs">
                          <Mail className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                          <span>
                            {language === 'vi' ? 'Khôi phục mật khẩu qua Email OTP 6 số' : 'Email OTP Password Recovery'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          {language === 'vi'
                            ? 'Nhập địa chỉ Email tài khoản của bạn để nhận mã xác thực OTP 6 số tự động gửi về hộp thư điện tử.'
                            : 'Enter your account email to receive a 6-digit OTP verification code sent directly to your inbox.'}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {language === 'vi' ? 'Địa chỉ Email tài khoản' : 'Account Email'}{' '}
                            <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[10px] text-slate-400">
                            {language === 'vi' ? 'Ví dụ: engineer@gmail.com' : 'e.g. name@gmail.com'}
                          </span>
                        </div>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-600/70 dark:text-cyan-400/80" />
                          <input
                            type="email"
                            required
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="your-email@gmail.com"
                            className="tech-input w-full pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !forgotEmail.trim()}
                        className="tech-btn-3d-cyan w-full py-3 rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <RotateCw className="w-4 h-4 animate-spin" />
                            {language === 'vi' ? 'Đang gửi mã xác thực OTP 6 số...' : 'Sending 6-digit OTP...'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Send className="w-4 h-4" />
                            {language === 'vi' ? 'Gửi mã xác thực OTP về Email' : 'Send 6-digit OTP code'}
                          </span>
                        )}
                      </button>
                    </form>
                  )}

                  {/* QUÊN MẬT KHẨU - BƯỚC 2: NHẬP MÃ OTP & ĐẶT MẬT KHẨU MỚI */}
                  {forgotStep === 'otp_reset' && (
                    <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                      {/* Recipient Notice Banner */}
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white text-xs">
                              {language === 'vi' ? 'Đã gửi mã OTP vào email của bạn' : 'OTP code has been sent to your email'}
                            </p>
                            <p className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs truncate mt-0.5">
                              {forgotEmail}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setForgotStep('input');
                              setErrorMessage(null);
                            }}
                            className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer shrink-0"
                          >
                            {language === 'vi' ? 'Đổi email' : 'Change'}
                          </button>
                        </div>
                      </div>

                      {/* 6 OTP Box Inputs */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block text-center">
                          {language === 'vi' ? 'Nhập mã xác thực OTP 6 số từ Email' : 'Enter 6-digit OTP code from Email'}{' '}
                          <span className="text-rose-500">*</span>
                        </label>

                        <div className="flex justify-center gap-2 sm:gap-2.5 my-2" onPaste={handleForgotDigitPaste}>
                          {forgotOtpDigits.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => {
                                forgotDigitInputRefs.current[idx] = el;
                              }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleForgotDigitChange(idx, e.target.value)}
                              onKeyDown={(e) => handleForgotDigitKeyDown(idx, e)}
                              className={`
                                w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-black rounded-2xl
                                border-2 transition-all duration-150 outline-none
                                ${
                                  digit
                                    ? 'bg-white dark:bg-[#0c1a2c] border-cyan-500 dark:border-cyan-400 text-cyan-600 dark:text-cyan-300 shadow-md shadow-cyan-500/15'
                                    : 'bg-white/80 dark:bg-[#071322] border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white shadow-inner focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20'
                                }
                              `}
                            />
                          ))}
                        </div>

                        {/* Resend Cooldown */}
                        <div className="text-center pt-1">
                          {cooldown > 0 ? (
                            <span className="text-[11px] font-mono text-slate-400 flex items-center justify-center gap-1">
                              <RotateCw className="w-3 h-3 animate-spin" />
                              {language === 'vi' ? `Gửi lại mã OTP sau ${cooldown}s` : `Resend in ${cooldown}s`}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleResendForgotOtp}
                              disabled={loading}
                              className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                            >
                              {language === 'vi'
                                ? 'Chưa nhận được mã? Gửi lại Email'
                                : 'Didn’t get code? Resend OTP'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mật khẩu mới */}
                      <div className="space-y-1.5 pt-2 border-t border-cyan-200/50 dark:border-cyan-900/50">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {language === 'vi' ? 'Mật khẩu mới' : 'New Password'}{' '}
                            <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[10px] text-slate-400">
                            {language === 'vi' ? 'Tối thiểu 6 ký tự' : 'Min 6 chars'}
                          </span>
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-600/70 dark:text-cyan-400/80" />
                          <input
                            type={showForgotNewPassword ? 'text' : 'password'}
                            required
                            value={forgotNewPassword}
                            onChange={(e) => setForgotNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className="tech-input w-full pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                          >
                            {showForgotNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Xác nhận mật khẩu mới & Kiểm tra tương thích */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {language === 'vi' ? 'Xác nhận mật khẩu mới' : 'Confirm New Password'}{' '}
                            <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[10px] text-slate-400">
                            {language === 'vi' ? 'Bắt buộc nhập 2 lần' : 'Required twice'}
                          </span>
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-600/70 dark:text-cyan-400/80" />
                          <input
                            type={showForgotConfirmPassword ? 'text' : 'password'}
                            required
                            value={forgotConfirmNewPassword}
                            onChange={(e) => setForgotConfirmNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className={`tech-input w-full pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 transition ${
                              forgotConfirmNewPassword.length === 0
                                ? ''
                                : forgotNewPassword === forgotConfirmNewPassword
                                ? '!border-emerald-500 focus:!border-emerald-500 bg-emerald-500/5'
                                : '!border-rose-500 focus:!border-rose-500 bg-rose-500/5'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                          >
                            {showForgotConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Real-time compatibility indicator */}
                        <div className="pt-0.5">
                          {forgotConfirmNewPassword.length === 0 ? (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500">
                              {language === 'vi' ? 'Nhập lại mật khẩu mới để kiểm tra tương thích.' : 'Re-enter password to check compatibility.'}
                            </div>
                          ) : forgotNewPassword === forgotConfirmNewPassword ? (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold animate-in fade-in">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{language === 'vi' ? 'Mật khẩu xác nhận trùng khớp hoàn toàn (100%)!' : 'Passwords match!'}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-bold animate-in fade-in">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{language === 'vi' ? 'Mật khẩu xác nhận chưa khớp. Vui lòng kiểm tra lại.' : 'Passwords do not match.'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={
                          loading ||
                          forgotOtpDigits.join('').length !== 6 ||
                          forgotNewPassword.length < 6 ||
                          forgotNewPassword !== forgotConfirmNewPassword
                        }
                        className="tech-btn-3d-cyan w-full py-3 rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-3"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <RotateCw className="w-4 h-4 animate-spin" />
                            {language === 'vi' ? 'Đang cập nhật mật khẩu mới...' : 'Updating password...'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            {language === 'vi' ? 'Xác nhận & Đặt lại mật khẩu mới' : 'Confirm & Reset Password'}
                          </span>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                /* ================= AUTHENTICATION FLOW (SIGN IN / SIGN UP) ================= */
                <div className="space-y-4 animate-in fade-in">
                  {/* Segmented Tactile Switcher (Đăng nhập / Đăng ký) */}
                  {step === 'credentials' && (
                    <div className="bg-slate-200/70 dark:bg-[#06111f] p-1.5 rounded-2xl border border-slate-300/70 dark:border-cyan-900/50 flex gap-1.5 shadow-inner">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthTab('signin');
                          setErrorMessage(null);
                        }}
                        className={`
                          flex-1 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer
                          ${
                            authTab === 'signin'
                              ? 'tech-btn-3d-cyan !py-2 !rounded-xl !text-xs !shadow-sm'
                              : 'tech-btn-secondary !bg-transparent !border-transparent !shadow-none text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400'
                          }
                        `}
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>{language === 'vi' ? 'Đăng nhập' : 'Sign In'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAuthTab('signup');
                          setErrorMessage(null);
                        }}
                        className={`
                          flex-1 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer
                          ${
                            authTab === 'signup'
                              ? 'tech-btn-3d-cyan !py-2 !rounded-xl !text-xs !shadow-sm'
                              : 'tech-btn-secondary !bg-transparent !border-transparent !shadow-none text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400'
                          }
                        `}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{language === 'vi' ? 'Đăng ký tài khoản' : 'Sign Up'}</span>
                      </button>
                    </div>
                  )}

                  {/* Status Alerts */}
                  {errorMessage && (
                    <div className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/50 border border-rose-300/80 dark:border-rose-800/80 text-xs text-rose-800 dark:text-rose-200 space-y-2 shadow-sm animate-in fade-in">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed font-medium">{errorMessage}</span>
                      </div>

                      {/* Quick Tab Switch Assist */}
                      {authTab === 'signin' && (errorMessage.includes('chưa được đăng ký') || errorMessage.includes('chưa đăng ký')) && (
                        <div className="pl-6.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAuthTab('signup');
                              setErrorMessage(null);
                            }}
                            className="tech-btn-3d-cyan !py-1 !px-3 !rounded-lg !text-[11px] font-bold"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{language === 'vi' ? 'Chuyển sang Đăng ký ngay' : 'Switch to Sign Up'}</span>
                          </button>
                        </div>
                      )}

                      {authTab === 'signup' && (errorMessage.includes('đã được đăng ký') || errorMessage.includes('đã tồn tại')) && (
                        <div className="pl-6.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAuthTab('signin');
                              setErrorMessage(null);
                            }}
                            className="tech-btn-3d-cyan !py-1 !px-3 !rounded-lg !text-[11px] font-bold"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>{language === 'vi' ? 'Chuyển sang Đăng nhập ngay' : 'Switch to Sign In'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-300/80 dark:border-emerald-800/80 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5 shadow-sm animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed font-medium">{successMessage}</span>
                    </div>
                  )}

                  {/* ================= STEP 1: NHẬP THÔNG TIN TÀI KHOẢN & MẬT KHẨU ================= */}
                  {step === 'credentials' && (
                    <form onSubmit={handleStartAuth} className="space-y-3.5">
                      {/* Full Name (Sign Up only) */}
                      {authTab === 'signup' && (
                        <div className="space-y-1.5 animate-in fade-in">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {language === 'vi' ? 'Họ và tên kỹ sư / học viên' : 'Full Name'}{' '}
                            <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-600/70 dark:text-cyan-400/80" />
                            <input
                              type="text"
                              required
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder={language === 'vi' ? 'Nguyễn Văn A' : 'Alex Johnson'}
                              className="tech-input w-full pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400"
                            />
                          </div>
                        </div>
                      )}

                      {/* FIELD: Email Address */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {language === 'vi' ? 'Địa chỉ Gmail / Email tài khoản' : 'Gmail / Email Address'}{' '}
                          <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-600/70 dark:text-cyan-400/80" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your-email@gmail.com"
                            className={`tech-input w-full pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 transition ${
                              emailCheck.status === 'not_found' ||
                              (authTab === 'signup' && emailCheck.status === 'already_registered') ||
                              (authTab === 'signin' && emailCheck.status === 'not_registered')
                                ? '!border-rose-400 dark:!border-rose-700 focus:!border-rose-500'
                                : emailCheck.status === 'valid'
                                ? '!border-emerald-400 dark:!border-emerald-700 focus:!border-emerald-500'
                                : ''
                            }`}
                          />
                        </div>

                        {/* Live Email Status Indicator */}
                        {emailCheck.checking && (
                          <div className="flex items-center gap-1.5 text-[11px] text-cyan-600 dark:text-cyan-400 py-0.5 animate-in fade-in">
                            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                            <span>{language === 'vi' ? 'Đang kiểm tra hộp thư & máy chủ email...' : 'Verifying email domain...'}</span>
                          </div>
                        )}
                        {!emailCheck.checking && emailCheck.status === 'not_found' && (
                          <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-bold py-0.5 animate-in fade-in">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{emailCheck.message || (language === 'vi' ? 'Hộp thư hoặc tên miền này không tồn tại.' : 'Email domain does not exist.')}</span>
                          </div>
                        )}
                        {!emailCheck.checking && emailCheck.status === 'invalid_format' && (
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 py-0.5 animate-in fade-in">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{emailCheck.message}</span>
                          </div>
                        )}
                        {!emailCheck.checking && emailCheck.status === 'already_registered' && authTab === 'signup' && (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 mt-1 animate-in fade-in">
                            <span className="flex items-center gap-1.5 font-bold">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              {emailCheck.message}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setAuthTab('signin');
                                setErrorMessage(null);
                              }}
                              className="text-cyan-600 dark:text-cyan-400 font-extrabold hover:underline shrink-0 cursor-pointer"
                            >
                              {language === 'vi' ? 'Đăng nhập ngay →' : 'Sign In now →'}
                            </button>
                          </div>
                        )}
                        {!emailCheck.checking && emailCheck.status === 'not_registered' && authTab === 'signin' && (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 mt-1 animate-in fade-in">
                            <span className="flex items-center gap-1.5 font-bold">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              {emailCheck.message}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setAuthTab('signup');
                                setErrorMessage(null);
                              }}
                              className="text-cyan-600 dark:text-cyan-400 font-extrabold hover:underline shrink-0 cursor-pointer"
                            >
                              {language === 'vi' ? 'Đăng ký ngay →' : 'Sign Up now →'}
                            </button>
                          </div>
                        )}
                        {!emailCheck.checking && emailCheck.status === 'valid' && (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold py-0.5 animate-in fade-in">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{emailCheck.message}</span>
                          </div>
                        )}
                      </div>

                      {/* Password */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {authTab === 'signup'
                              ? (language === 'vi' ? 'Mật khẩu (Lần 1)' : 'Password (Step 1)')
                              : (language === 'vi' ? 'Mật khẩu đăng nhập' : 'Password')}{' '}
                            <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[10px] text-slate-400">
                            {language === 'vi' ? 'Tối thiểu 6 ký tự' : 'Min 6 chars'}
                          </span>
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-600/70 dark:text-cyan-400/80" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="tech-input w-full pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Quên mật khẩu link for Sign In */}
                      {authTab === 'signin' && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-400">
                            {language === 'vi' ? 'Không nhớ mật khẩu?' : 'Forgot your password?'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsForgotPassword(true);
                              setForgotEmail(email);
                              setForgotStep('input');
                              setErrorMessage(null);
                              setSuccessMessage(null);
                            }}
                            className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 hover:underline transition cursor-pointer flex items-center gap-1"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-cyan-500" />
                            <span>
                              {language === 'vi'
                                ? 'Quên mật khẩu? (Khôi phục qua OTP)'
                                : 'Forgot Password?'}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Confirm Password (Required for Sign Up with Compatibility Validation) */}
                      {authTab === 'signup' && (
                        <div className="space-y-1.5 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <span>{language === 'vi' ? 'Nhập lại mật khẩu (Lần 2)' : 'Confirm Password (Step 2)'}</span>
                              <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {language === 'vi' ? 'Bắt buộc nhập 2 lần' : 'Required twice'}
                            </span>
                          </div>
                          <div className="relative">
                            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-600/70 dark:text-cyan-400/80" />
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              required
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder={language === 'vi' ? 'Nhập lại chính xác mật khẩu trên' : 'Re-enter password to match'}
                              className={`tech-input w-full pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 transition ${
                                confirmPassword.length === 0
                                  ? ''
                                  : password === confirmPassword
                                  ? '!border-emerald-500 focus:!border-emerald-500 bg-emerald-500/5'
                                  : '!border-rose-500 focus:!border-rose-500 bg-rose-500/5'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                            >
                              {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          {/* Real-time Password Compatibility Indicator */}
                          <div className="pt-0.5">
                            {confirmPassword.length === 0 ? (
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{language === 'vi' ? 'Bắt buộc nhập mật khẩu 2 lần để kiểm tra độ tương thích.' : 'Password confirmation is required.'}</span>
                              </div>
                            ) : password === confirmPassword ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold animate-in fade-in">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>{language === 'vi' ? 'Hai mật khẩu tương thích và hoàn toàn trùng khớp (100%)!' : 'Passwords match perfectly (100%)!'}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-bold animate-in fade-in">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{language === 'vi' ? 'Hai mật khẩu không tương thích (chưa khớp nhau).' : 'Passwords do not match.'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Submit 3D Button */}
                      <button
                        type="submit"
                        disabled={
                          loading ||
                          !email.trim() ||
                          password.length < 6 ||
                          (authTab === 'signup' && (!fullName.trim() || !confirmPassword || password !== confirmPassword))
                        }
                        className="tech-btn-3d-cyan w-full py-3 rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <RotateCw className="w-4 h-4 animate-spin" />
                            {language === 'vi'
                              ? 'Đang kiểm tra hộp thư & gửi mã OTP...'
                              : 'Sending OTP verification code to email...'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Send className="w-4 h-4" />
                            {authTab === 'signin'
                              ? (language === 'vi' ? 'Đăng nhập & Nhận mã OTP qua Email' : 'Sign In & Get Email OTP')
                              : (language === 'vi' ? 'Đăng ký tài khoản & Nhận mã OTP qua Email' : 'Create Account & Get Email OTP')}
                          </span>
                        )}
                      </button>
                    </form>
                  )}

                  {/* ================= STEP 2: NHẬP MÃ OTP 6 CHỮ SỐ ================= */}
                  {step === 'otp' && (
                    <div className="space-y-4 animate-in fade-in">
                      {/* Back button */}
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-cyan-200/50 dark:border-cyan-900/50">
                        <button
                          type="button"
                          onClick={() => {
                            setStep('credentials');
                            setErrorMessage(null);
                            setSuccessMessage(null);
                          }}
                          className="tech-btn-secondary px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>{language === 'vi' ? 'Sửa thông tin email / mật khẩu' : 'Edit email / password'}</span>
                        </button>

                        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold truncate max-w-[190px]">
                          {email}
                        </span>
                      </div>

                      {/* Recipient Notice Box */}
                      <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-400/40 dark:border-cyan-500/30 text-xs text-slate-800 dark:text-slate-200 shadow-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-400/40">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white text-xs">
                              {language === 'vi' ? 'Đã gửi mã OTP vào email của bạn' : 'OTP code has been sent to your email'}
                            </p>
                            <p className="font-mono font-bold text-cyan-600 dark:text-cyan-400 text-xs truncate mt-0.5">
                              {email}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setStep('credentials');
                              setErrorMessage(null);
                            }}
                            className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer shrink-0"
                          >
                            {language === 'vi' ? 'Đổi email' : 'Change'}
                          </button>
                        </div>
                      </div>

                      {/* 6 Box Inputs */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block text-center">
                          {language === 'vi' ? 'Nhập mã xác thực 6 chữ số từ email' : 'Enter 6-digit verification code'}{' '}
                          <span className="text-rose-500">*</span>
                        </label>

                        <div className="flex justify-center gap-2 sm:gap-2.5 my-3" onPaste={handleDigitPaste}>
                          {otpDigits.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => {
                                digitInputRefs.current[idx] = el;
                              }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleDigitChange(idx, e.target.value)}
                              onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                              className={`
                                w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-mono font-black rounded-2xl
                                border-2 transition-all duration-150 outline-none
                                ${
                                  digit
                                    ? 'bg-white dark:bg-[#0c1a2c] border-cyan-500 dark:border-cyan-400 text-cyan-600 dark:text-cyan-300 shadow-md shadow-cyan-500/15'
                                    : 'bg-white/80 dark:bg-[#071322] border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white shadow-inner focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20'
                                }
                              `}
                            />
                          ))}
                        </div>

                        {/* Resend Countdown */}
                        <div className="flex items-center justify-center text-xs pt-1">
                          {cooldown > 0 ? (
                            <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5 font-mono text-[11px]">
                              <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                              {language === 'vi' ? `Gửi lại mã sau ${cooldown}s` : `Resend in ${cooldown}s`}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleResendOtp}
                              className="text-cyan-600 dark:text-cyan-400 hover:underline font-bold text-[11px] cursor-pointer"
                            >
                              {language === 'vi'
                                ? 'Chưa nhận được mã? Gửi lại Email'
                                : 'Resend code to email'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Verify Action Button */}
                      <button
                        type="button"
                        onClick={() => handleVerifyOtp()}
                        disabled={loading || otpDigits.join('').length !== 6}
                        className="tech-btn-3d-cyan w-full py-3 rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-3"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <RotateCw className="w-4 h-4 animate-spin" />
                            {language === 'vi' ? 'Đang kiểm tra mã...' : 'Verifying code...'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            {authTab === 'signup'
                              ? (language === 'vi' ? 'Xác thực & Hoàn tất đăng ký' : 'Verify & Complete Registration')
                              : (language === 'vi' ? 'Xác thực & Đăng nhập' : 'Verify & Sign In')}
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
