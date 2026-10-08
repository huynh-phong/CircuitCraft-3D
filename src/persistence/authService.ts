import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabase } from './supabaseClient';

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: 'vi' | 'en';
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: 'user' | 'pro' | 'admin' | 'creator';
  preferences?: UserPreferences;
}

export interface SignUpResult {
  success: boolean;
  requiresEmailConfirmation?: boolean;
  error?: string;
}

export class AuthService {
  private currentUser: User | null = null;
  private currentSession: Session | null = null;
  private currentProfile: UserProfile | null = null;
  private sessionToken: string | null = null;
  private serverVerifiedAdmin: boolean = false;
  private authListeners: Array<(user: User | null, profile: UserProfile | null) => void> = [];

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) {
      this.restoreLocalSession();
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      this.currentSession = session;
      this.currentUser = session?.user ?? null;
      if (this.currentUser) {
        await this.fetchProfile(this.currentUser);
      } else {
        this.restoreLocalSession();
      }
      this.notifyListeners();

      supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
          case 'USER_UPDATED':
            this.currentSession = session;
            this.currentUser = session?.user ?? null;
            if (this.currentUser) {
              await this.fetchProfile(this.currentUser);
            }
            break;
          case 'SIGNED_OUT':
            this.currentSession = null;
            this.currentUser = null;
            this.currentProfile = null;
            break;
          default:
            this.currentSession = session;
            this.currentUser = session?.user ?? null;
            if (this.currentUser) {
              await this.fetchProfile(this.currentUser);
            } else {
              this.currentProfile = null;
            }
            break;
        }

        this.notifyListeners();
      });
    } catch (err) {
      console.warn('Auth initialization error:', err);
    }
  }

  private async fetchProfile(user: User): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      let localPrefs: UserPreferences | undefined;
      try {
        const raw = localStorage.getItem(`circuitcraft_pref_${user.id}`);
        if (raw) localPrefs = JSON.parse(raw);
      } catch {
        // ignore
      }

      if (!error && data) {
        this.currentProfile = {
          id: data.id,
          email: data.email || user.email || '',
          fullName: data.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          avatarUrl: data.avatar_url,
          role: data.role || 'user',
          preferences: data.preferences || user.user_metadata?.preferences || localPrefs,
        };
      } else {
        // Fallback profile from user metadata if row has not been populated yet
        this.currentProfile = {
          id: user.id,
          email: user.email || '',
          fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          avatarUrl: user.user_metadata?.avatar_url,
          role: 'user',
          preferences: user.user_metadata?.preferences || localPrefs,
        };
      }
    } catch {
      this.currentProfile = {
        id: user.id,
        email: user.email || '',
        fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        role: 'user',
      };
    }

    await this.syncSessionWithBackend();
  }

  public async syncSessionWithBackend(): Promise<void> {
    if (!this.currentProfile || !this.currentProfile.email) return;
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.currentProfile.id,
          email: this.currentProfile.email,
          fullName: this.currentProfile.fullName,
          isVerified: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionToken) {
          this.sessionToken = data.sessionToken;
          try {
            localStorage.setItem('circuitcraft_session_token', data.sessionToken);
          } catch {}
        }
        if (data.user) {
          this.serverVerifiedAdmin = Boolean(data.user.isAdmin && data.user.role === 'admin');
          this.currentProfile = {
            ...this.currentProfile,
            id: data.user.id || this.currentProfile.id,
            role: data.user.role || 'user',
          };
          try {
            localStorage.setItem('circuitcraft_custom_user', JSON.stringify(this.currentProfile));
          } catch {}
          this.notifyListeners();
        }
      }
    } catch {
      // ignore offline error
    }
  }

  public getSessionToken(): string | null {
    if (this.sessionToken) return this.sessionToken;
    try {
      const saved = localStorage.getItem('circuitcraft_session_token');
      if (saved) {
        this.sessionToken = saved;
        return saved;
      }
    } catch {}
    return this.currentSession?.access_token || null;
  }

  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.getSessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (this.currentProfile?.email) {
      headers['X-User-Email'] = this.currentProfile.email;
    }
    if (this.currentProfile?.id) {
      headers['X-User-Id'] = this.currentProfile.id;
    }
    return headers;
  }

  public isAdmin(): boolean {
    return Boolean(this.currentProfile?.role === 'admin' && this.serverVerifiedAdmin);
  }

  private notifyListeners(): void {
    for (const listener of this.authListeners) {
      try {
        listener(this.currentUser, this.currentProfile);
      } catch (err) {
        console.error('Error in auth listener:', err);
      }
    }
  }

  public onAuthStateChange(listener: (user: User | null, profile: UserProfile | null) => void): () => void {
    this.authListeners.push(listener);
    // Trigger immediately with current state
    listener(this.currentUser, this.currentProfile);

    return () => {
      this.authListeners = this.authListeners.filter((l) => l !== listener);
    };
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public getCurrentSession(): Session | null {
    return this.currentSession;
  }

  public getCurrentProfile(): UserProfile | null {
    return this.currentProfile;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.currentUser);
  }

  public async signUp(
    email: string,
    password: string,
    fullName?: string
  ): Promise<SignUpResult> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Chưa cấu hình kết nối Supabase Cloud.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Case A: User created, but email confirmation is required (session is null)
      if (data.user && !data.session) {
        return {
          success: true,
          requiresEmailConfirmation: true,
        };
      }

      // Case B: User created with session immediately (Email Confirmation is OFF)
      if (data.user && data.session) {
        this.currentUser = data.user;
        this.currentSession = data.session;
        await this.fetchProfile(data.user);
        this.notifyListeners();
        return {
          success: true,
          requiresEmailConfirmation: false,
        };
      }

      return { success: true, requiresEmailConfirmation: false };
    } catch (err: any) {
      return { success: false, error: err.message || 'Đăng ký tài khoản thất bại' };
    }
  }

  public async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Chưa cấu hình kết nối Supabase Cloud.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let msg = error.message;
        if (error.message.toLowerCase().includes('email not confirmed')) {
          msg = 'Tài khoản chưa được kích hoạt email. Vui lòng bấm link xác thực trong hộp thư đến (hoặc thư mục Spam), hoặc tắt "Confirm email" trong Supabase Dashboard.';
        } else if (
          error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('invalid credentials')
        ) {
          msg = 'Email hoặc mật khẩu không chính xác, hoặc tài khoản chưa được xác nhận.';
        }
        return { success: false, error: msg };
      }

      this.currentUser = data.user;
      this.currentSession = data.session;
      if (data.user) {
        await this.fetchProfile(data.user);
        this.notifyListeners();
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Đăng nhập thất bại' };
    }
  }

  public async updateFullName(name: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabase();
    if (!this.currentUser) return { success: false, error: 'Chưa đăng nhập' };

    try {
      if (supabase) {
        await supabase
          .from('profiles')
          .update({ full_name: name })
          .eq('id', this.currentUser.id);

        await supabase.auth.updateUser({
          data: { full_name: name },
        });
      }

      if (this.currentProfile) {
        this.currentProfile.fullName = name;
      }
      this.notifyListeners();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi cập nhật tên' };
    }
  }

  public async updatePreferences(prefs: Partial<UserPreferences>): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) return { success: false, error: 'Chưa đăng nhập' };

    const merged = {
      ...(this.currentProfile?.preferences || {}),
      ...prefs,
    };

    if (this.currentProfile) {
      this.currentProfile.preferences = merged;
    }

    try {
      const storageKey = `circuitcraft_pref_${this.currentUser.id}`;
      localStorage.setItem(storageKey, JSON.stringify(merged));
    } catch {
      // ignore
    }

    try {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.auth.updateUser({
          data: { preferences: merged },
        });
        await supabase
          .from('profiles')
          .update({ preferences: merged })
          .eq('id', this.currentUser.id);
      }
      this.notifyListeners();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private restoreLocalSession(): void {
    try {
      const savedToken = localStorage.getItem('circuitcraft_session_token');
      if (savedToken) {
        this.sessionToken = savedToken;
      }
      const raw = localStorage.getItem('circuitcraft_custom_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id && parsed.email) {
          // Never trust a cached local role === 'admin' until backend verifies it via syncSessionWithBackend
          this.currentUser = { id: parsed.id, email: parsed.email } as any;
          this.currentProfile = {
            ...parsed,
            role: parsed.role === 'admin' ? 'user' : parsed.role || 'user',
          };
          this.syncSessionWithBackend();
        }
      }
    } catch {}
  }

  /**
   * Check whether email format is valid and registration status
   */
  public async checkEmailStatus(
    email: string,
    intent: 'signin' | 'signup'
  ): Promise<{
    success: boolean;
    registered: boolean;
    validFormat: boolean;
    existsOnInternet?: boolean;
    message?: string;
  }> {
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), intent }),
      });
      const data = await res.json();
      return {
        success: Boolean(data.success),
        registered: Boolean(data.registered),
        validFormat: data.validFormat ?? true,
        existsOnInternet: data.existsOnInternet ?? true,
        message: data.message,
      };
    } catch (err: any) {
      return {
        success: false,
        registered: false,
        validFormat: true,
        existsOnInternet: true,
        message: err.message,
      };
    }
  }

  /**
   * Request 6-digit OTP email from CircuitCraft 3D with email existence & account validation
   */
  public async sendEmailOtp(
    email: string,
    fullName?: string,
    intent?: 'signin' | 'signup',
    password?: string
  ): Promise<{
    success: boolean;
    message: string;
    cooldownSeconds?: number;
    simulated?: boolean;
    previewHtml?: string;
    codePreview?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName?.trim(),
          intent,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Không thể gửi mã OTP. Vui lòng thử lại.',
          error: data.message,
          cooldownSeconds: data.cooldownSeconds || 0,
        };
      }

      return {
        success: true,
        message: data.message,
        cooldownSeconds: data.cooldownSeconds || 60,
        simulated: data.simulated,
        previewHtml: data.previewHtml,
        codePreview: data.codePreview,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Lỗi kết nối máy chủ xác thực.',
        error: err.message,
      };
    }
  }

  /**
   * Checks if an email bounced (e.g. Google Mail Delivery Subsystem 550 NoSuchUser)
   */
  public async checkDeliveryStatus(email: string): Promise<{
    bounced: boolean;
    message?: string;
  }> {
    try {
      const res = await fetch(`/api/auth/check-delivery-status?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      return {
        bounced: Boolean(data.bounced),
        message: data.message,
      };
    } catch {
      return { bounced: false };
    }
  }

  /**
   * Verify the 6-digit OTP code and authenticate user
   */
  public async verifyEmailOtp(
    email: string,
    code: string,
    intent?: 'signin' | 'signup',
    password?: string,
    fullName?: string,
    phone?: string
  ): Promise<{ success: boolean; message: string; user?: UserProfile; error?: string }> {
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          intent,
          password,
          fullName: fullName?.trim(),
          phone: phone?.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Mã xác nhận không đúng hoặc đã hết hạn.',
          error: data.message,
        };
      }

      const isAdminFromServer = Boolean(data.user?.isAdmin && data.user?.role === 'admin');
      this.serverVerifiedAdmin = isAdminFromServer;
      if (data.sessionToken) {
        this.sessionToken = data.sessionToken;
        try {
          localStorage.setItem('circuitcraft_session_token', data.sessionToken);
        } catch {}
      }

      const profile: UserProfile = {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName || data.user.email.split('@')[0],
        phone: data.user.phone,
        role: isAdminFromServer ? 'admin' : data.user.role || 'user',
      };

      this.currentUser = { id: profile.id, email: profile.email } as any;
      this.currentProfile = profile;

      try {
        localStorage.setItem('circuitcraft_custom_user', JSON.stringify(profile));
      } catch {}

      this.notifyListeners();

      return {
        success: true,
        message: data.message || 'Đăng nhập thành công!',
        user: profile,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Lỗi kết nối xác thực mã OTP.',
        error: err.message,
      };
    }
  }

  /**
   * Check phone format and registration status
   */
  public async checkPhoneStatus(
    phone: string,
    intent: 'signin' | 'signup'
  ): Promise<{
    success: boolean;
    validFormat?: boolean;
    registered?: boolean;
    message?: string;
  }> {
    try {
      const res = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), intent }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Không thể kiểm tra số điện thoại.',
      };
    }
  }

  /**
   * Send 6-digit OTP code to phone number for login or registration
   */
  public async sendPhoneOtp(params: {
    phone: string;
    intent: 'signin' | 'signup';
    fullName?: string;
    password?: string;
    email?: string;
  }): Promise<{
    success: boolean;
    message: string;
    cooldownSeconds?: number;
    codePreview?: string;
    smsText?: string;
    simulated?: boolean;
  }> {
    try {
      const res = await fetch('/api/auth/send-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Không thể gửi mã OTP tới số điện thoại này.',
          cooldownSeconds: data.cooldownSeconds || 0,
        };
      }

      return {
        success: true,
        message: data.message,
        cooldownSeconds: data.cooldownSeconds || 60,
        codePreview: data.codePreview,
        smsText: data.smsText,
        simulated: data.simulated,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Lỗi kết nối khi gửi mã OTP qua điện thoại.',
      };
    }
  }

  /**
   * Verify 6-digit OTP code sent to phone number and sign in or register
   */
  public async verifyPhoneOtp(params: {
    phone: string;
    code: string;
    intent: 'signin' | 'signup';
    password?: string;
    fullName?: string;
    email?: string;
  }): Promise<{
    success: boolean;
    message: string;
    user?: UserProfile;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/auth/verify-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Mã xác nhận điện thoại không đúng hoặc đã hết hạn.',
          error: data.message,
        };
      }

      const profile: UserProfile = {
        id: data.user?.id || `usr-phone-${Date.now()}`,
        email: data.user?.email || `${params.phone}@circuitcraft.vn`,
        fullName: data.user?.fullName || params.fullName || `Kỹ sư ${params.phone}`,
        phone: params.phone,
        role: (data.user?.role as any) || 'user',
      };

      this.currentUser = { id: profile.id, email: profile.email } as any;
      this.currentProfile = profile;

      try {
        localStorage.setItem('circuitcraft_custom_user', JSON.stringify(profile));
      } catch {}

      this.notifyListeners();

      return {
        success: true,
        message: data.message || 'Xác thực số điện thoại thành công!',
        user: profile,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Lỗi kết nối xác thực mã OTP điện thoại.',
        error: err.message,
      };
    }
  }

  /**
   * Update role for the current user (e.g. 'creator', 'user')
   */
  public async updateRole(newRole: 'user' | 'creator' | 'pro' | 'admin'): Promise<{ success: boolean; message?: string }> {
    if (!this.currentProfile) {
      return { success: false, message: 'Chưa đăng nhập.' };
    }

    try {
      const res = await fetch('/api/user/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrId: this.currentProfile.id || this.currentProfile.email, role: newRole }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const serverRole = data.role || (newRole === 'admin' ? 'user' : newRole);
        this.serverVerifiedAdmin = Boolean(data.isAdmin && serverRole === 'admin');
        this.currentProfile.role = serverRole;
        try {
          localStorage.setItem('circuitcraft_custom_user', JSON.stringify(this.currentProfile));
        } catch {}
        this.notifyListeners();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Không thể cập nhật vai trò.' };
    } catch (err) {
      console.warn('Could not update role on backend:', err);
    }

    // Fallback local update (never allow self-assigning 'admin')
    if (newRole === 'admin') {
      return { success: false, message: 'Không được phép tự gán quyền Quản trị viên.' };
    }
    this.currentProfile.role = this.serverVerifiedAdmin ? 'admin' : newRole;
    try {
      localStorage.setItem('circuitcraft_custom_user', JSON.stringify(this.currentProfile));
    } catch {}
    this.notifyListeners();
    return { success: true, message: `Đã chuyển đổi quyền thành công: ${this.currentProfile.role}` };
  }

  /**
   * Request 6-digit OTP code sent to Email for password recovery
   */
  public async sendForgotPasswordEmailOtp(
    email: string
  ): Promise<{
    success: boolean;
    message: string;
    cooldownSeconds?: number;
    codePreview?: string;
    previewHtml?: string;
    simulated?: boolean;
    accountEmail?: string;
    accountName?: string;
  }> {
    try {
      const res = await fetch('/api/auth/forgot-password/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Không thể gửi mã OTP tới địa chỉ email này.',
          cooldownSeconds: data.cooldownSeconds || 0,
        };
      }

      return {
        success: true,
        message: data.message,
        cooldownSeconds: data.cooldownSeconds || 60,
        codePreview: data.codePreview,
        previewHtml: data.previewHtml,
        simulated: data.simulated,
        accountEmail: data.email,
        accountName: data.fullName,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Lỗi kết nối máy chủ khi gửi mã xác thực qua email.',
      };
    }
  }

  /**
   * Reset password with Email OTP 6-digit code
   */
  public async resetPasswordWithEmailOtp(params: {
    email: string;
    code: string;
    newPassword: string;
    confirmPassword?: string;
  }): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      const res = await fetch('/api/auth/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email.trim().toLowerCase(),
          code: params.code.trim(),
          newPassword: params.newPassword,
          confirmPassword: params.confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Không thể đặt lại mật khẩu.',
        };
      }

      return {
        success: true,
        message: data.message || 'Đặt lại mật khẩu thành công!',
        user: data.user,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Lỗi kết nối khi đặt lại mật khẩu.',
      };
    }
  }

  /**
   * Request 6-digit OTP code sent to phone number to recover password
   */
  public async sendForgotPasswordPhoneOtp(
    phone: string,
    email?: string
  ): Promise<{
    success: boolean;
    message: string;
    cooldownSeconds?: number;
    codePreview?: string;
    smsText?: string;
    simulated?: boolean;
    accountEmail?: string;
    accountName?: string;
  }> {
    try {
      const res = await fetch('/api/auth/forgot-password/send-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          email: email?.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Không thể gửi mã OTP tới số điện thoại này.',
          cooldownSeconds: data.cooldownSeconds || 0,
        };
      }

      return {
        success: true,
        message: data.message,
        cooldownSeconds: data.cooldownSeconds || 60,
        codePreview: data.codePreview,
        smsText: data.smsText,
        simulated: data.simulated,
        accountEmail: data.accountEmail,
        accountName: data.accountName,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Lỗi kết nối máy chủ xác thực qua điện thoại.',
      };
    }
  }

  /**
   * Reset password with Phone OTP code
   */
  public async resetPasswordWithPhoneOtp(params: {
    phone: string;
    code: string;
    newPassword: string;
    confirmPassword?: string;
    email?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/auth/forgot-password/reset-phone-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Không thể đặt lại mật khẩu.',
        };
      }

      return {
        success: true,
        message: data.message || 'Đặt lại mật khẩu thành công!',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Lỗi kết nối khi đặt lại mật khẩu.',
      };
    }
  }

  /**
   * Get latest dispatched SMS for preview / inspection
   */
  public async getDispatchedSmsPreview(phone: string): Promise<{ success: boolean; sms?: any; error?: string }> {
    try {
      const res = await fetch(`/api/auth/sms-preview/${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Chưa tìm thấy tin nhắn' };
      }
      return { success: true, sms: data.sms };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Retrieve the latest dispatched email for recipient for inspection
   */
  public async getDispatchedEmailPreview(email: string): Promise<{ success: boolean; email?: any; error?: string }> {
    try {
      const res = await fetch(`/api/auth/email-preview/${encodeURIComponent(email.trim().toLowerCase())}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Chưa tìm thấy email' };
      }
      return { success: true, email: data.email };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async signOut(): Promise<void> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out error:', err);
      }
    }

    try {
      localStorage.removeItem('circuitcraft_custom_user');
      localStorage.removeItem('circuitcraft_session_token');
    } catch {}

    this.currentUser = null;
    this.currentSession = null;
    this.currentProfile = null;
    this.sessionToken = null;
    this.serverVerifiedAdmin = false;
    this.notifyListeners();
  }
}

export const authService = new AuthService();
