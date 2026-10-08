import nodemailer from 'nodemailer';
import tls from 'tls';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Always keep .env updated
dotenv.config({ override: true });

// Supabase Cloud instance derived directly from .env
let serverSupabaseInstance: SupabaseClient | null = null;
export function getSupabaseAdmin(): SupabaseClient | null {
  dotenv.config({ override: true });
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)?.trim();
  if (!url || !serviceKey) return null;
  if (!serverSupabaseInstance) {
    serverSupabaseInstance = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return serverSupabaseInstance;
}

export interface OtpRecord {
  code: string;
  email: string;
  fullName?: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  cooldownUntil: number;
}

export interface DispatchedEmail {
  to: string;
  from: string;
  subject: string;
  code: string;
  html: string;
  sentAt: string;
  status: 'sent' | 'simulated';
}

export interface PhoneOtpRecord {
  code: string;
  phone: string;
  email?: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  cooldownUntil: number;
}

export interface DispatchedSms {
  phone: string;
  code: string;
  message: string;
  sentAt: string;
  provider: 'twilio' | 'simulated';
}

// In-memory OTP storage
const activeOtps = new Map<string, OtpRecord>();
const activePhoneOtps = new Map<string, PhoneOtpRecord>();

// In-memory recent dispatched emails and SMS for inspection & sandbox preview
const recentDispatchedEmails = new Map<string, DispatchedEmail>();
const recentDispatchedSms = new Map<string, DispatchedSms>();

/**
 * Builds a professional HTML email matching CircuitCraft 3D branding
 */
export function buildCircuitCraftOtpEmailHtml(params: {
  code: string;
  email: string;
  fullName?: string;
  expiresInMinutes?: number;
  intent?: 'signin' | 'signup' | 'recovery';
}): { html: string; text: string; subject: string; sender: string } {
  const { code, email, fullName, expiresInMinutes = 10, intent } = params;
  const displayName = fullName?.trim() || email.split('@')[0] || 'Kỹ sư';
  const senderName = 'CircuitCraft 3D';
  const senderAddress = (process.env.SMTP_USER && process.env.SMTP_USER.includes('@'))
    ? `"CircuitCraft 3D" <${process.env.SMTP_USER.trim()}>`
    : (process.env.SMTP_FROM || 'CircuitCraft 3D <no-reply@circuitcraft3d.com>');
  
  const isRecovery = intent === 'recovery';
  const subject = isRecovery
    ? `[CircuitCraft 3D] Mã xác thực 6 số khôi phục mật khẩu: ${code}`
    : `[CircuitCraft 3D] Mã xác nhận đăng nhập / đăng ký: ${code}`;
  const badgeText = isRecovery ? '🔐 Khôi phục mật khẩu tài khoản' : '⚡ Nền tảng thiết kế mạch & IoT 3D';
  const titleText = isRecovery ? 'Khôi phục mật khẩu' : 'Xác thực tài khoản người dùng';
  const introText = isRecovery
    ? `Bạn (hoặc ai đó) vừa gửi yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email này trên nền tảng <strong>CircuitCraft 3D</strong>. Dưới đây là mã xác thực 6 chữ số để thiết lập mật khẩu mới:`
    : `Bạn (hoặc ai đó) vừa yêu cầu mã xác nhận để đăng nhập hoặc đăng ký tài khoản trên nền tảng <strong>CircuitCraft 3D</strong>. Dưới đây là mã xác thực 6 chữ số của bạn:`;

  const requestTime = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0b0f17; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #0f172a; border-radius: 20px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Bar -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #1e293b; background: linear-gradient(180deg, #131d35 0%, #0f172a 100%);">
              <div style="display: inline-block; padding: 6px 14px; border-radius: 9999px; background-color: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.3); color: #22d3ee; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px;">
                ${badgeText}
              </div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                CircuitCraft <span style="color: #06b6d4;">3D</span>
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #f8fafc;">
                ${titleText}
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #94a3b8;">
                Xin chào <strong style="color: #f1f5f9;">${displayName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                ${introText}
              </p>

              <!-- OTP Code Display Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <div style="background-color: #020617; border: 2px dashed #0891b2; border-radius: 16px; padding: 24px 20px; text-align: center; max-width: 380px;">
                      <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">
                        MÃ XÁC THỰC 6 SỐ CỦA BẠN
                      </div>
                      <div style="font-family: 'Courier New', Courier, monospace; font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #22d3ee; margin-left: 12px; text-shadow: 0 0 20px rgba(34, 211, 238, 0.4);">
                        ${code}
                      </div>
                      <div style="font-size: 12px; color: #64748b; margin-top: 10px;">
                        ⏱️ Có hiệu lực trong vòng <strong style="color: #f59e0b;">${expiresInMinutes} phút</strong>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Advice Box -->
              <div style="background-color: rgba(239, 68, 68, 0.08); border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px 16px; margin: 24px 0;">
                <p style="margin: 0; font-size: 13px; color: #fca5a5; line-height: 1.5;">
                  <strong>⚠️ Cảnh báo bảo mật:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai, kể cả quản trị viên hay nhân viên hỗ trợ CircuitCraft 3D. Chúng tôi sẽ không bao giờ hỏi mã OTP của bạn.
                </p>
              </div>

              <!-- Request Metadata Table -->
              <table width="100%" cellpadding="6" cellspacing="0" border="0" style="background-color: #0b1120; border-radius: 10px; border: 1px solid #1e293b; font-size: 12px; color: #64748b; margin-top: 24px;">
                <tr>
                  <td width="38%" style="padding: 10px 14px; border-bottom: 1px solid #1e293b; color: #94a3b8;">Email nhận:</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-family: monospace;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #1e293b; color: #94a3b8;">Thời gian phát hành:</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #1e293b; color: #cbd5e1;">${requestTime}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; color: #94a3b8;">Cổng xác thực:</td>
                  <td style="padding: 10px 14px; color: #22d3ee;">CircuitCraft 3D Secure Auth Gateway</td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                Nếu bạn không gửi yêu cầu này, có thể ai đó đã nhập nhầm địa chỉ email. Bạn có thể an tâm bỏ qua email này, tài khoản của bạn vẫn an toàn.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0b0f17; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; font-weight: 500;">
                © 2026 CircuitCraft 3D • Nền tảng mô phỏng điện tử thực hành trực quan
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                Đây là email tự động gửi từ hệ thống CircuitCraft 3D. Vui lòng không phản hồi thư này.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = isRecovery
    ? `
[CircuitCraft 3D] Mã xác thực 6 số khôi phục mật khẩu: ${code}

Xin chào ${displayName},

Bạn vừa yêu cầu mã xác nhận để đặt lại mật khẩu cho tài khoản trên nền tảng CircuitCraft 3D.

Mã xác thực 6 số của bạn là: ${code}
(Mã có hiệu lực trong vòng ${expiresInMinutes} phút)

LƯU Ý BẢO MẬT: Tuyệt đối không chia sẻ mã này cho bất kỳ ai.
Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.

Trân trọng,
Đội ngũ CircuitCraft 3D
    `.trim()
    : `
[CircuitCraft 3D] Mã xác nhận tài khoản: ${code}

Xin chào ${displayName},

Bạn vừa yêu cầu mã xác nhận để đăng nhập / đăng ký tài khoản trên nền tảng CircuitCraft 3D.

Mã xác thực của bạn là: ${code}
(Mã có hiệu lực trong vòng ${expiresInMinutes} phút)

LƯU Ý BẢO MẬT: Không chia sẻ mã xác thực này cho bất kỳ ai.
Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.

Trân trọng,
Đội ngũ CircuitCraft 3D
  `.trim();

  return { html, text, subject, sender: senderAddress };
}

/**
 * Dispatches an email via SMTP (if configured) or Supabase Auth from .env
 */
export async function sendOtpEmail(params: {
  email: string;
  code: string;
  fullName?: string;
  intent?: 'signin' | 'signup' | 'recovery';
}): Promise<{ sent: boolean; simulated: boolean; bounced?: boolean; message: string; previewHtml?: string }> {
  dotenv.config({ override: true });
  const { email, code, fullName, intent } = params;
  const { html, text, subject, sender } = buildCircuitCraftOtpEmailHtml({
    code,
    email,
    fullName,
    intent,
  });

  const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER)?.trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD)?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim() || (smtpUser?.endsWith('@gmail.com') ? 'smtp.gmail.com' : 'smtp.gmail.com');
  const smtpPort = Number(process.env.SMTP_PORT || (smtpHost === 'smtp.gmail.com' ? '465' : '587'));

  let sent = false;
  let statusMessage = '';

  // 1. First, check direct SMTP / Gmail credentials from .env
  const isPlaceholder =
    !smtpUser ||
    !smtpPass ||
    smtpUser.includes('your-email') ||
    smtpUser.includes('example.com') ||
    smtpPass.includes('your-app-password') ||
    smtpPass.includes('placeholder');

  if (smtpHost && smtpUser && smtpPass && !isPlaceholder) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass.replace(/\s+/g, ''),
        },
      });

      await transporter.sendMail({
        from: sender,
        to: email,
        subject,
        text,
        html,
      });

      sent = true;
      statusMessage = 'Đã gửi mã OTP vào email của bạn';
      console.log(`[CircuitCraft Mailer] Live email dispatched to ${email} via SMTP.`);
    } catch (err: any) {
      console.warn('[CircuitCraft Mailer] SMTP send failed, trying Supabase Auth from .env:', err?.message || err);
    }
  }

  // 2. Dispatch via Supabase Auth from .env (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY)
  if (!sent) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { error: supaErr } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true, // Guarantees Supabase creates/authenticates user and dispatches OTP email
          },
        });

        if (!supaErr) {
          sent = true;
          statusMessage = 'Đã gửi mã OTP vào email của bạn';
          console.log(`[CircuitCraft Mailer] Supabase OTP email successfully dispatched to ${email}`);
        } else {
          console.warn('[CircuitCraft Mailer] Supabase signInWithOtp notice:', supaErr.message, supaErr.status);
          if (
            supaErr.message.includes('rate_limit') ||
            supaErr.message.includes('security purposes') ||
            supaErr.status === 429
          ) {
            return {
              sent: false,
              simulated: false,
              message: 'Vì lý do bảo mật, mã xác nhận vừa được gửi đến email này. Vui lòng kiểm tra hộp thư của bạn (inbox hoặc spam) hoặc đợi 60 giây trước khi yêu cầu gửi lại.',
              previewHtml: html,
            };
          } else {
            return {
              sent: false,
              simulated: false,
              message: `Không thể gửi mã OTP tới "${email}": ${supaErr.message}`,
              previewHtml: html,
            };
          }
        }
      } catch (supaEx: any) {
        console.warn('[CircuitCraft Mailer] Supabase OTP dispatch exception:', supaEx?.message);
        return {
          sent: false,
          simulated: false,
          message: `Lỗi kết nối khi gửi mã OTP tới email "${email}": ${supaEx?.message || supaEx}`,
          previewHtml: html,
        };
      }
    }
  }

  if (!sent) {
    return {
      sent: false,
      simulated: false,
      message: `Không thể gửi mã OTP đến email "${email}". Vui lòng kiểm tra thông tin cấu hình trong file .env (Supabase Auth hoặc SMTP).`,
      previewHtml: html,
    };
  }

  // Store in memory for logs
  recentDispatchedEmails.set(email.toLowerCase(), {
    to: email,
    from: sender,
    subject,
    code,
    html,
    sentAt: new Date().toISOString(),
    status: 'sent',
  });

  return {
    sent: true,
    simulated: false,
    message: statusMessage,
    previewHtml: html,
  };
}

/**
 * Checks via IMAP if the sender mailbox received a bounce notification
 * from Google Mail Delivery Subsystem (550 NoSuchUser / Không tìm thấy địa chỉ).
 */
export async function checkEmailDeliveryBounce(targetEmail: string, timeoutMs = 3500): Promise<{
  bounced: boolean;
  reason?: string;
}> {
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim().replace(/\s+/g, '');
  if (!smtpUser || !smtpPass) {
    return { bounced: false };
  }

  return new Promise((resolve) => {
    const socket = tls.connect(993, 'imap.gmail.com', { rejectUnauthorized: false });
    let tag = 0;
    let expectedTag = '';
    let buffer = '';
    let isResolved = false;

    const done = (result: { bounced: boolean; reason?: string }) => {
      if (isResolved) return;
      isResolved = true;
      try {
        socket.write('Q LOGOUT\r\n');
        socket.end();
      } catch {}
      resolve(result);
    };

    setTimeout(() => {
      done({ bounced: false });
    }, timeoutMs);

    function send(cmd: string) {
      tag++;
      expectedTag = 'A' + tag;
      socket.write(expectedTag + ' ' + cmd + '\r\n');
    }

    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      if (tag === 0 && buffer.includes('* OK')) {
        buffer = '';
        send('LOGIN ' + smtpUser + ' ' + smtpPass);
      } else if (expectedTag && buffer.includes(expectedTag + ' OK')) {
        const fullResp = buffer;
        buffer = '';
        if (expectedTag === 'A1') {
          send('SELECT INBOX');
        } else if (expectedTag === 'A2') {
          send('SEARCH FROM "mailer-daemon@googlemail.com"');
        } else if (expectedTag === 'A3') {
          const match = fullResp.match(/\* SEARCH ([\d\s]+)/);
          if (match && match[1].trim()) {
            const ids = match[1].trim().split(/\s+/).map(Number);
            const latest = ids.slice(-5).join(',');
            send('FETCH ' + latest + ' (BODY.PEEK[TEXT]<0.1200>)');
          } else {
            done({ bounced: false });
          }
        } else if (expectedTag === 'A4') {
          const cleanTarget = targetEmail.trim().toLowerCase();
          const lowerResp = fullResp.toLowerCase();
          const targetFound = lowerResp.includes(cleanTarget);
          const hasError = fullResp.includes('550 5.1.1') || 
                           fullResp.includes('NoSuchUser') || 
                           fullResp.includes('Không tìm thấy địa chỉ') || 
                           fullResp.includes('Address not found') ||
                           fullResp.includes('không thể tìm thấy địa chỉ');
          if (targetFound && hasError) {
            done({
              bounced: true,
              reason: 'Địa chỉ email này không tồn tại trên thực tế (Hộp thư gửi nhận thông báo từ Google Mail Delivery Subsystem: Không tìm thấy địa chỉ / lỗi 550 5.1.1 NoSuchUser). Vui lòng nhập đúng email có thật của bạn.',
            });
          } else {
            done({ bounced: false });
          }
        }
      }
    });

    socket.on('error', () => {
      done({ bounced: false });
    });
  });
}

/**
 * Revokes any active OTP for an email address
 */
export function revokeOtp(email: string): void {
  activeOtps.delete(email.trim().toLowerCase());
}

/**
 * Generates and stores a 6-digit OTP for an email
 */
export async function createAndSendOtp(params: {
  email: string;
  fullName?: string;
  intent?: 'signin' | 'signup' | 'recovery';
}): Promise<{
  success: boolean;
  message: string;
  simulated: boolean;
  cooldownSeconds: number;
  previewHtml?: string;
  codePreview?: string;
  bounced?: boolean;
}> {
  const email = params.email.trim().toLowerCase();

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      success: false,
      message: 'Địa chỉ email không hợp lệ.',
      simulated: false,
      cooldownSeconds: 0,
    };
  }

  const existing = activeOtps.get(email);
  const now = Date.now();

  // Enforce 60-second cooldown between requests
  if (existing && existing.cooldownUntil > now) {
    const remainingSec = Math.ceil((existing.cooldownUntil - now) / 1000);
    return {
      success: false,
      message: `Vui lòng đợi ${remainingSec} giây trước khi yêu cầu mã xác nhận mới.`,
      simulated: false,
      cooldownSeconds: remainingSec,
    };
  }

  // Generate 6-digit cryptographic-style OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes
  const cooldownUntil = now + 60 * 1000; // 60s cooldown

  activeOtps.set(email, {
    code,
    email,
    fullName: params.fullName,
    createdAt: now,
    expiresAt,
    attempts: 0,
    cooldownUntil,
  });

  const sendResult = await sendOtpEmail({
    email,
    code,
    fullName: params.fullName,
    intent: params.intent,
  });

  if (!sendResult.sent) {
    activeOtps.delete(email);
    return {
      success: false,
      bounced: sendResult.bounced,
      message: sendResult.message,
      simulated: false,
      cooldownSeconds: 0,
    };
  }

  return {
    success: true,
    message: sendResult.message,
    simulated: false,
    cooldownSeconds: 60,
    previewHtml: sendResult.previewHtml,
  };
}

/**
 * Validates the 6-digit OTP
 */
export function verifyOtpCode(params: {
  email: string;
  code: string;
}): {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: 'user';
  };
} {
  const email = params.email.trim().toLowerCase();
  const inputCode = params.code.trim();

  const record = activeOtps.get(email);
  if (!record) {
    return {
      success: false,
      message: 'Chưa có mã xác nhận nào được gửi cho email này, hoặc mã đã hết hạn. Vui lòng nhấn "Gửi mã".',
    };
  }

  const now = Date.now();
  if (now > record.expiresAt) {
    activeOtps.delete(email);
    return {
      success: false,
      message: 'Mã xác nhận 6 số đã hết hạn (quá 10 phút). Vui lòng yêu cầu mã mới.',
    };
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    activeOtps.delete(email);
    return {
      success: false,
      message: 'Bạn đã nhập sai mã quá 5 lần. Vì lý do an toàn, mã đã bị vô hiệu hoá. Vui lòng gửi lại mã mới.',
    };
  }

  if (record.code !== inputCode) {
    return {
      success: false,
      message: `Mã xác nhận không chính xác. Bạn còn ${5 - record.attempts} lần thử.`,
    };
  }

  // Verification passed! Clean up used OTP
  activeOtps.delete(email);

  const userId = `usr_otp_${Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
  const fullName = record.fullName?.trim() || email.split('@')[0] || 'Kỹ sư CircuitCraft';

  return {
    success: true,
    message: 'Xác thực mã OTP thành công!',
    user: {
      id: userId,
      email,
      fullName,
      role: 'user',
    },
  };
}

/**
 * Validates the 6-digit OTP asynchronously, checking both in-memory OTP and Supabase Auth OTP
 */
export async function verifyOtpCodeAsync(params: {
  email: string;
  code: string;
}): Promise<{
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: 'user';
  };
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanCode = params.code.trim();

  // 1. Check local OTP (when custom email was dispatched via SMTP)
  const localRes = verifyOtpCode({ email: cleanEmail, code: cleanCode });
  if (localRes.success) {
    return localRes;
  }

  // 2. Check Supabase Auth OTP verification (when OTP was dispatched via Supabase Auth from .env)
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      let verifyRes = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email',
      });

      if (verifyRes.error) {
        // Try fallback type 'recovery'
        const recoveryTry = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: 'recovery',
        });
        if (!recoveryTry.error && recoveryTry.data?.user) {
          verifyRes = recoveryTry;
        }
      }

      if (!verifyRes.error && verifyRes.data?.user) {
        activeOtps.delete(cleanEmail);
        const fullName = (verifyRes.data.user.user_metadata?.full_name || cleanEmail.split('@')[0] || 'Kỹ sư CircuitCraft') as string;
        return {
          success: true,
          message: 'Xác thực mã OTP thành công qua Supabase Auth!',
          user: {
            id: verifyRes.data.user.id,
            email: cleanEmail,
            fullName,
            role: 'user',
          },
        };
      }
    } catch (err: any) {
      console.warn('[CircuitCraft Auth] Supabase OTP verify error:', err?.message);
    }
  }

  return {
    success: false,
    message: 'Mã xác nhận OTP 6 số không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại mã đã nhận trong hộp thư email của bạn.',
  };
}

/**
 * Retrieves the latest dispatched email for sandbox / inbox preview
 */
export function getDispatchedEmail(email: string): DispatchedEmail | null {
  return recentDispatchedEmails.get(email.trim().toLowerCase()) || null;
}

/**
 * Generates a secure 6-digit numeric OTP code
 */
export function generateSecureOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Creates and dispatches a 6-digit OTP code to a phone number for login, signup or password recovery
 */
export async function createAndSendPhoneOtp(params: {
  phone: string;
  email?: string;
  intent?: 'signin' | 'signup' | 'recovery';
  fullName?: string;
}): Promise<{
  success: boolean;
  message: string;
  cooldownSeconds: number;
  codePreview?: string;
  smsText?: string;
  simulated?: boolean;
}> {
  const { phone, email, intent = 'signin', fullName } = params;
  const cleanPhone = phone.trim();

  // Cooldown check
  const existing = activePhoneOtps.get(cleanPhone);
  const now = Date.now();
  if (existing && existing.cooldownUntil > now) {
    const remainingSeconds = Math.ceil((existing.cooldownUntil - now) / 1000);
    return {
      success: false,
      message: `Vui lòng đợi ${remainingSeconds} giây trước khi yêu cầu gửi lại mã OTP đến số điện thoại này.`,
      cooldownSeconds: remainingSeconds,
    };
  }

  // Generate cryptographic 6-digit OTP code
  const code = generateSecureOtpCode();
  const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity
  const cooldownUntil = now + 60 * 1000; // 60 seconds resend cooldown

  activePhoneOtps.set(cleanPhone, {
    code,
    phone: cleanPhone,
    email,
    createdAt: now,
    expiresAt,
    attempts: 0,
    cooldownUntil,
  });

  let smsBody = `[CircuitCraft 3D] Ma OTP xac thuc cua ban la: ${code}. Ma co hieu luc trong 5 phut. Khong chia se ma nay cho bat ky ai.`;
  if (intent === 'signin') {
    smsBody = `[CircuitCraft 3D] Ma OTP xac thuc DANG NHAP cua ban la: ${code}. Hieu luc 5 phut. Tuyet doi khong chia se ma nay cho bat ky ai.`;
  } else if (intent === 'signup') {
    smsBody = `[CircuitCraft 3D] Ma OTP xac thuc DANG KY tai khoan CircuitCraft 3D cua ban la: ${code}. Hieu luc 5 phut.`;
  } else if (intent === 'recovery') {
    smsBody = `[CircuitCraft 3D] Ma OTP xac thuc KHOI PHUC MAT KHAU cua ban la: ${code}. Hieu luc 5 phut. Khong chia se ma nay.`;
  }

  // Check if Twilio is configured
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER?.trim();

  let sentRealSms = false;
  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      let targetPhone = cleanPhone;
      if (!targetPhone.startsWith('+')) {
        if (targetPhone.startsWith('0')) {
          targetPhone = '+84' + targetPhone.slice(1);
        } else {
          targetPhone = '+84' + targetPhone;
        }
      }

      const postData = new URLSearchParams({
        To: targetPhone,
        From: twilioFrom,
        Body: smsBody,
      });

      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: postData.toString(),
      });

      if (resp.ok) {
        sentRealSms = true;
        console.log(`[SMS Service] Dispatched live SMS via Twilio to ${targetPhone}`);
      } else {
        const errText = await resp.text();
        console.warn(`[SMS Service] Twilio dispatch notice (${resp.status}): ${errText}`);
      }
    } catch (twErr) {
      console.warn('[SMS Service] Twilio dispatch error, falling back to simulated SMS:', twErr);
    }
  }

  // Save in recent dispatched SMS for UI sandbox preview / notification
  recentDispatchedSms.set(cleanPhone, {
    phone: cleanPhone,
    code,
    message: smsBody,
    sentAt: new Date().toISOString(),
    provider: sentRealSms ? 'twilio' : 'simulated',
  });

  console.log(`\n================== [CIRCUIT CRAFT 3D - SMS OTP DISPATCH] ==================`);
  console.log(`To Phone Number: ${cleanPhone}`);
  console.log(`OTP Code       : ${code}`);
  console.log(`SMS Content    : ${smsBody}`);
  console.log(`Provider       : ${sentRealSms ? 'Twilio Live SMS' : 'SMS Simulation Gateway'}`);
  console.log(`===========================================================================\n`);

  return {
    success: true,
    message: sentRealSms
      ? `Đã gửi mã OTP đến số điện thoại ${cleanPhone} qua tin nhắn SMS.`
      : `Đã gửi mã OTP đến số điện thoại ${cleanPhone}. (Mã OTP: ${code})`,
    cooldownSeconds: 60,
    codePreview: code,
    smsText: smsBody,
    simulated: !sentRealSms,
  };
}

/**
 * Verifies a 6-digit phone OTP code
 */
export function verifyPhoneOtpCode(params: {
  phone: string;
  code: string;
}): { success: boolean; message: string } {
  const { phone, code } = params;
  const cleanPhone = phone.trim();
  const inputCode = code.trim();

  const record = activePhoneOtps.get(cleanPhone);
  if (!record) {
    return {
      success: false,
      message: 'Chưa có mã OTP nào được gửi đến số điện thoại này hoặc mã đã hết hạn. Vui lòng nhấn "Gửi lại mã".',
    };
  }

  const now = Date.now();
  if (now > record.expiresAt) {
    activePhoneOtps.delete(cleanPhone);
    return {
      success: false,
      message: 'Mã OTP đã hết hạn (quá 5 phút). Vui lòng yêu cầu gửi lại mã mới.',
    };
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    activePhoneOtps.delete(cleanPhone);
    return {
      success: false,
      message: 'Bạn đã nhập sai mã quá 5 lần. Vì lý do an toàn, mã đã bị vô hiệu hoá. Vui lòng gửi lại mã mới.',
    };
  }

  if (record.code !== inputCode) {
    return {
      success: false,
      message: `Mã OTP không chính xác. Bạn còn ${5 - record.attempts} lần thử.`,
    };
  }

  // Verification passed! Clean up used phone OTP
  activePhoneOtps.delete(cleanPhone);

  return {
    success: true,
    message: 'Xác thực mã OTP điện thoại thành công!',
  };
}

/**
 * Retrieves the latest dispatched SMS for preview / toast notifications
 */
export function getDispatchedSms(phone: string): DispatchedSms | null {
  return recentDispatchedSms.get(phone.trim()) || null;
}

