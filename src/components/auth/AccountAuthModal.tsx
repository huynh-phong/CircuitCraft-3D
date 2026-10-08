import React, { useState } from 'react';
import { User, LogIn, LogOut, ShieldCheck, Mail, Key, Sparkles, Smartphone, CheckCircle2, AlertCircle, ArrowLeft, Send, Check } from 'lucide-react';
import { Dialog, Button, Badge } from '../ui/designSystem.tsx';
import { UserProfile, UserTier } from '../../types/circuit.ts';
import { ProjectRepository } from '../../services/projectRepository.ts';
import { authService } from '../../persistence/authService.ts';

interface AccountAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUserUpdate: (user: UserProfile | null) => void;
}

export const AccountAuthModal: React.FC<AccountAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdate,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Forgot password OTP states
  const [forgotStep, setForgotStep] = useState<'email' | 'otp_reset'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmNewPassword, setForgotConfirmNewPassword] = useState('');
  const [otpNotice, setOtpNotice] = useState<{ code: string; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (authMode === 'register') {
      if (!confirmPassword) {
        setErrorMessage('Ở đăng ký, bắt buộc phải nhập mật khẩu 2 lần để kiểm tra tương thích.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Hai mật khẩu không tương thích (không trùng khớp). Vui lòng nhập lại.');
        return;
      }
    }

    setIsLoading(true);

    setTimeout(() => {
      const user: UserProfile = {
        id: 'usr_' + Math.random().toString(36).substring(2, 8),
        email: email || 'student@circuitverse3d.edu.vn',
        name: name || email.split('@')[0] || 'Kỹ Sư CircuitVerse',
        tier: 'student' as UserTier,
        createdAt: new Date().toISOString(),
      };

      ProjectRepository.setCurrentUser(user);
      onUserUpdate(user);
      setIsLoading(false);
      onClose();
    }, 600);
  };

  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setErrorMessage('Vui lòng nhập địa chỉ email để nhận mã OTP.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await authService.sendForgotPasswordEmailOtp(forgotEmail.trim());
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.message || 'Không thể gửi mã xác thực OTP tới email.');
      return;
    }

    setForgotStep('otp_reset');
    setSuccessMessage(`Đã gửi mã xác thực OTP 6 số về email ${forgotEmail.trim()}.`);
    if (res.codePreview) {
      setOtpNotice({ code: res.codePreview, text: `Mã OTP khôi phục mật khẩu gửi tới ${forgotEmail.trim()} là: ${res.codePreview}` });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotOtp.trim().length !== 6) {
      setErrorMessage('Mã xác thực OTP phải đủ 6 chữ số.');
      return;
    }
    if (forgotNewPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmNewPassword) {
      setErrorMessage('Hai mật khẩu không tương thích (không trùng khớp).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const res = await authService.resetPasswordWithEmailOtp({
      email: forgotEmail.trim(),
      code: forgotOtp.trim(),
      newPassword: forgotNewPassword,
      confirmPassword: forgotConfirmNewPassword,
    });
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.message || 'Không thể đặt lại mật khẩu.');
      return;
    }

    setSuccessMessage('Khôi phục mật khẩu thành công! Bạn có thể đăng nhập ngay.');
    setTimeout(() => {
      setAuthMode('login');
      setForgotStep('email');
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 1500);
  };

  const handleLogout = () => {
    ProjectRepository.setCurrentUser(null);
    onUserUpdate(null);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        currentUser
          ? 'Thông tin tài khoản'
          : authMode === 'login'
          ? 'Đăng nhập CircuitVerse 3D'
          : authMode === 'register'
          ? 'Đăng ký tài khoản'
          : 'Khôi phục mật khẩu qua Email OTP 6 số'
      }
      description={
        currentUser
          ? 'Quản lý thông tin đăng nhập và quyền hạn gói hiện tại của bạn.'
          : authMode === 'forgot'
          ? 'Khôi phục mật khẩu an toàn bằng mã xác thực OTP 6 số gửi về Email của bạn.'
          : 'Đăng nhập để đồng bộ dự án lên Cloud và mở khóa các tính năng nâng cao.'
      }
    >
      {currentUser ? (
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Họ và tên:</span>
              <strong className="text-white text-sm">{currentUser.name}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Email:</span>
              <span className="text-slate-200">{currentUser.email}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-slate-400">Hạng gói (Tier):</span>
              <Badge variant={currentUser.tier === 'free' ? 'slate' : 'emerald'}>
                {currentUser.tier.toUpperCase()} MEMBER
              </Badge>
            </div>
          </div>

          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Tài khoản của bạn đã được liên kết thành công với cơ chế lưu trữ an toàn. Dữ liệu nháp của khách vẫn được bảo toàn.
            </span>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="danger"
              size="sm"
              onClick={handleLogout}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
            >
              Đăng xuất
            </Button>
          </div>
        </div>
      ) : authMode === 'forgot' ? (
        <div className="space-y-4 text-xs">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại đăng nhập</span>
          </button>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {forgotStep === 'email' ? (
            <form onSubmit={handleSendForgotOtp} className="space-y-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Địa chỉ Email nhận mã OTP</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="email@example.com"
                    required
                    className="w-full pl-9 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                className="w-full mt-2"
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Gửi mã xác thực OTP 6 số về Email
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-3">
              {otpNotice && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
                  <div className="flex items-center justify-between font-mono font-bold">
                    <span>Mã OTP (Sandbox): {otpNotice.code}</span>
                    <button
                      type="button"
                      onClick={() => setForgotOtp(otpNotice.code)}
                      className="text-xs bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-semibold cursor-pointer"
                    >
                      Điền ngay
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">{otpNotice.text}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Mã xác thực OTP (6 chữ số)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  required
                  className="w-full font-mono text-center tracking-widest text-lg bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Mật khẩu mới</label>
                <input
                  type="password"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Nhập lại mật khẩu mới (Lần 2)</label>
                <input
                  type="password"
                  value={forgotConfirmNewPassword}
                  onChange={(e) => setForgotConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white focus:outline-none transition ${
                    forgotConfirmNewPassword.length === 0
                      ? 'border-slate-700 focus:border-emerald-500'
                      : forgotNewPassword === forgotConfirmNewPassword
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-rose-500 bg-rose-500/10'
                  }`}
                />
                {forgotConfirmNewPassword && (
                  <div className="text-[11px] pt-1">
                    {forgotNewPassword === forgotConfirmNewPassword ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Mật khẩu xác nhận trùng khớp!
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Mật khẩu không trùng khớp.
                      </span>
                    )}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                className="w-full mt-2"
                disabled={!forgotOtp || forgotNewPassword.length < 6 || forgotNewPassword !== forgotConfirmNewPassword}
              >
                Xác nhận & Đổi mật khẩu
              </Button>
            </form>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {authMode === 'register' && (
            <>
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Họ và tên</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Số điện thoại (Nhận OTP khôi phục)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912345678"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-slate-300 font-medium">Địa chỉ Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenban@example.com"
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-medium">
                {authMode === 'register' ? 'Mật khẩu (Lần 1)' : 'Mật khẩu'}
              </label>
              <span className="text-[10px] text-slate-400">Tối thiểu 6 ký tự</span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {authMode === 'register' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-medium">
                  Nhập lại mật khẩu (Lần 2) <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-slate-400">Bắt buộc nhập 2 lần</span>
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white focus:outline-none transition ${
                  confirmPassword.length === 0
                    ? 'border-slate-700 focus:border-emerald-500'
                    : password === confirmPassword
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-rose-500 bg-rose-500/10'
                }`}
              />
              <div className="text-[11px] pt-0.5">
                {confirmPassword.length === 0 ? (
                  <span className="text-slate-400">
                    Bắt buộc nhập mật khẩu 2 lần để kiểm tra độ tương thích.
                  </span>
                ) : password === confirmPassword ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Hai mật khẩu hoàn toàn tương thích và trùng khớp!
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> Hai mật khẩu không tương thích (chưa trùng khớp).
                  </span>
                )}
              </div>
            </div>
          )}

          {authMode === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('forgot');
                  setForgotStep('email');
                  setForgotEmail(email);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-xs text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Key className="w-3 h-3" />
                <span>Quên mật khẩu? (Khôi phục qua Email OTP 6 số)</span>
              </button>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full"
              disabled={authMode === 'register' && (!confirmPassword || password !== confirmPassword)}
            >
              {authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản mới'}
            </Button>

            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="text-center text-xs text-slate-400 hover:text-emerald-400 pt-2 transition cursor-pointer"
            >
              {authMode === 'login'
                ? 'Chưa có tài khoản? Bấm vào đây để đăng ký'
                : 'Đã có tài khoản? Đăng nhập ngay'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
};
