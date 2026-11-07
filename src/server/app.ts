import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import {
  createAndSendOtp,
  verifyOtpCode,
  verifyOtpCodeAsync,
  getDispatchedEmail,
  checkEmailDeliveryBounce,
  revokeOtp,
  createAndSendPhoneOtp,
  verifyPhoneOtpCode,
  getDispatchedSms,
} from './otpService.ts';
import {
  validateEmailFormat,
  validateEmailFormatAndExistence,
  isEmailRegistered,
  verifyUserPassword,
  registerNewUser,
  getUserByEmail,
  validatePhoneNumber,
  getUserByPhone,
  findUserByEmailOrPhone,
  updateUserPassword,
  linkUserPhone,
  getUserById,
  updateUserTier,
  updateUserRole,
  normalizePhoneNumber,
  getAdminEmail,
  isVerifiedAdminEmail,
  listAllUsers,
  touchUserActivity,
  ensureAuthenticatedUserRecord,
  adminUpdateUserRecord,
  syncPersonalProject,
  removePersonalProject,
  listAllPersonalProjects,
  listAllProjectVersions,
  recordCourseEnrollment,
  listAllCourseEnrollments,
  addSystemLog,
  listSystemLogs,
  getSystemSettings,
  updateSystemSettings,
  bumpSessionVersion,
} from './userStore.ts';
import {
  attachAuthUser,
  getAuthUser,
  getAuthSession,
  verifySessionToken,
  revokeSession,
  configureTrustProxy,
  missingServerConfig,
  sendRateLimited,
  rateLimitIdentity,
  requireAuth,
  isAdminUser,
  isSelfOrAdmin,
  createSessionToken,
  rateLimit,
  isDevPreviewEnabled,
} from './security.ts';
import { hitRateLimit, peekRateLimit, recordRateLimitHit } from './sharedState.ts';
import {
  flushPersistence,
  getPersistenceMode,
  isRemotePersistence,
  registerCollection,
  runWithWriteScope,
  saveCollection,
  syncFromRemote,
  takeRejectedWrites,
} from './persistence.ts';
import { CATALOG_DESIGNS } from './catalogDesigns.ts';
import { courseSummary, publicPreviewOnly } from './contentAccess.ts';
import { getPaymentMode, isMockPaymentAllowed, isMockOrder } from './paymentMode.ts';
import { normalizeChatRequest, AICircuitContext } from '../ai/circuitContext.ts';
import { validateAIProposal } from '../domain/ai/proposalValidation.ts';
import { COMPONENT_DEFINITION_MAP } from '../domain/components/definitions.ts';
import { MEMBERSHIP_PLAN_PRICES } from '../billing/membershipPlans.ts';
import { CATALOG_PRODUCTS } from '../marketplace/catalogData.ts';
import {
  CourseMediaError,
  externalizeSlideImages,
  createVideoUploadLink,
  isValidMediaFileName,
  isValidVideoFileName,
  resolveCourseMedia,
  resolveCourseVideoLink,
  saveCourseImage,
  signMediaPath,
  verifyMediaSignature,
  withSignedSlideImages,
} from './courseMedia.ts';
import { creatorStore, CatalogProductItem, ProductStatus } from './creatorStore.ts';
import { readJsonFile, writeJsonAtomic } from './atomicJson.ts';

// Always override container defaults with values explicitly defined in .env
dotenv.config({ override: true, quiet: true } as any);

const app = express();

configureTrustProxy(app);

// API answers are per-user and must not be stored by the CDN; a route may opt out explicitly
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// A deployment missing required settings says so instead of running with temporary storage or
// throw-away session keys. The response names the settings, never their values.
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  const missing = missingServerConfig();
  if (missing.length === 0) return next();
  console.error(`[Config] Missing required settings: ${missing.join(', ')}`);
  res.status(503).json({
    success: false,
    error: 'Máy chủ chưa được cấu hình đầy đủ. Vui lòng liên hệ quản trị viên.',
    code: 'SERVER_NOT_CONFIGURED',
  });
});

// Function instances can be frozen right after replying, so what a reply promises must already be
// stored: the database writes queued by a request finish before its response goes out.
app.use('/api', (_req, res, next) => {
  if (!isRemotePersistence()) return next();
  const endResponse = res.end.bind(res) as (...args: any[]) => any;
  let flushed = false;
  (res as any).end = (...args: any[]) => {
    if (flushed) return endResponse(...args);
    flushed = true;
    flushPersistence()
      .then(() => {
        // Another instance saved the same project first: this save did not happen, and the reply says so
        if (!takeRejectedWrites() || res.headersSent) return endResponse(...args);
        const body = JSON.stringify({
          success: false,
          error: 'Dự án vừa được lưu từ nơi khác. Hãy tải lại để xem bản mới nhất.',
          code: 'PROJECT_CONFLICT',
        });
        res.status(409);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Length', Buffer.byteLength(body));
        endResponse(body);
      })
      .catch((err) => {
        console.error('[Persistence] Could not store changes:', err?.message || err);
        if (res.headersSent) return endResponse(...args);
        const body = JSON.stringify({
          success: false,
          error: 'Không thể lưu dữ liệu lên máy chủ. Thay đổi chưa được ghi nhận, vui lòng thử lại.',
          code: 'PERSISTENCE_FAILED',
        });
        res.status(503);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Length', Buffer.byteLength(body));
        endResponse(body);
      });
    return res;
  };
  runWithWriteScope(next);
});

// See what other instances wrote (sessions revoked, orders paid...) before acting on this request
app.use('/api', async (req, res, next) => {
  if (req.path === '/health') return next();
  try {
    await syncFromRemote();
    next();
  } catch (err: any) {
    console.error('[Persistence] Could not read data:', err?.message || err);
    res.status(503).json({
      success: false,
      error: 'Máy chủ tạm thời không đọc được dữ liệu. Vui lòng thử lại sau ít phút.',
      code: 'PERSISTENCE_UNAVAILABLE',
    });
  }
});

// Resolve the authenticated user (Bearer token only) for every API request. Runs before body
// parsing so that large request bodies are only accepted from callers entitled to send them.
app.use('/api', attachAuthUser);

const DEFAULT_JSON_LIMIT = '100kb';
const jsonParsers = new Map<string, express.RequestHandler>();
function jsonParser(limit: string): express.RequestHandler {
  if (!jsonParsers.has(limit)) jsonParsers.set(limit, express.json({ limit }));
  return jsonParsers.get(limit)!;
}

function jsonLimitFor(req: express.Request): string {
  const route = req.baseUrl + req.path;
  const user = getAuthUser(req);
  if (user) {
    if (/^\/api\/projects(\/|$)/.test(route)) return '4mb';
    if (isCreatorUser(user.id)) {
      if (route === '/api/creator/media') return '2500kb'; // one slide image (1.5 MB) as base64
      if (/^\/api\/creator\/courses(\/|$)/.test(route)) return '4mb';
      if (/^\/api\/creator\/products(\/|$)/.test(route)) return '4mb';
    }
  }
  // Prompts carrying circuit / slide text. These routes are rate limited and do not need images.
  if (/^\/api\/ai\//.test(route) || route === '/api/courses/analyze-practice-project' || route === '/api/courses/theory-tutor') {
    return '1mb';
  }
  return DEFAULT_JSON_LIMIT;
}

app.use('/api', (req, res, next) => jsonParser(jsonLimitFor(req))(req, res, next));

// List of candidate models in order of priority (using official SDK models)
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];

// Lazy-initialized Gemini Client with live .env re-check
let geminiClient: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

function getGemini(): GoogleGenAI | null {
  // Re-read .env to catch any live updates made by user
  dotenv.config({ override: true, quiet: true } as any);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  if (!geminiClient || cachedApiKey !== apiKey) {
    geminiClient = new GoogleGenAI({ apiKey });
    cachedApiKey = apiKey;
  }
  return geminiClient;
}

// Helper to execute generation with multi-model fallback
async function generateWithGemini(ai: GoogleGenAI, request: { contents: any; config?: any }) {
  let lastError: any = null;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        ...request,
        model,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini] Model ${model} encountered an issue, trying fallback:`, err?.message || err);
    }
  }
  throw lastError;
}

// 1. Health check
app.get('/api/health', (req, res) => {
  const missing = missingServerConfig();
  res.status(missing.length ? 503 : 200).json({
    status: missing.length ? 'misconfigured' : 'ok',
    time: new Date().toISOString(),
    persistence: getPersistenceMode(),
    missingSettings: missing,
  });
});

// 1.1 AI Status check
app.get('/api/ai/status', (req, res) => {
  const ai = getGemini();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  res.json({
    status: ai ? 'connected' : 'unconfigured',
    hasKey: Boolean(apiKey),
    supportedModels: GEMINI_MODELS,
  });
});

// 2. AI Chat (Minibot Copilot in the 3D workspace)
// Canonical body: { prompt, history: [{role, content}], context: AICircuitContext } (see src/ai/circuitContext.ts).
// The legacy body { prompt, project, issues, simResult, practiceContext } is still accepted.
function describeCircuitContext(ctx: AICircuitContext | null): string {
  if (!ctx) return '';
  const lines = [
    `[TRẠNG THÁI MẠCH HIỆN TẠI – revision #${ctx.revision}${ctx.projectName ? `, dự án "${ctx.projectName}"` : ''}]`,
    `Linh kiện (${ctx.components.length}): ${JSON.stringify(ctx.components)}`,
    `Dây nối (${ctx.connectionsCount}): ${JSON.stringify(ctx.connections)}`,
    `Cảnh báo DRC (${ctx.issues.length}): ${JSON.stringify(ctx.issues)}`,
  ];
  if (ctx.simulation) lines.push(`Kết quả mô phỏng DC: ${JSON.stringify(ctx.simulation)}`);
  if (ctx.selectedComponentId) lines.push(`Linh kiện đang được chọn: ${ctx.selectedComponentId}`);
  return lines.join('\n');
}

function describePracticeContext(pc: AICircuitContext['practiceContext']): string {
  if (!pc) return '';
  return `\n\n[THÔNG TIN BÀI THỰC HÀNH KHÓA HỌC ĐANG MỞ]:
- Khóa học: "${pc.courseTitle || 'Khóa học CircuitCraft'}"
- Bài thực hành: "${pc.lessonTitle || ''}"
- Nội dung yêu cầu: ${pc.lessonSummary || ''}
- Linh kiện mục tiêu của giảng viên: ${JSON.stringify(pc.targetComponents || [])}
- Sơ đồ nối dây mục tiêu của giảng viên: ${JSON.stringify(pc.targetConnections || [])}
- Quy trình 3 giai đoạn chuẩn của bài thực hành:
${(pc.stages || []).map((st) => `  + Giai đoạn ${st.stageNumber} (${st.title}): ${(st.steps || []).join(' | ')}`).join('\n')}
Hãy hướng dẫn học viên bám sát đúng 3 giai đoạn (1. Thêm thiết bị/mạch -> 2. Nối dây -> 3. Chạy mô phỏng) dựa trên mạch chuẩn của giảng viên và đối chiếu với hiện trạng mạch của học viên!`;
}

app.post('/api/ai/chat', rateLimit('ai-chat', 30, 60 * 1000), async (req, res) => {
  const { prompt, history, context } = normalizeChatRequest(req.body);
  const locale = context?.locale || (req.body?.locale === 'en' ? 'en' : 'vi');

  if (!prompt.trim()) {
    return res.status(400).json({ error: 'Thiếu nội dung câu hỏi (prompt).' });
  }

  try {
    const ai = getGemini();
    if (!ai) {
      // Explicitly labelled local fallback (no AI model involved)
      return res.json({
        reply: locale === 'en'
          ? `[Minibot Local Assistant – AI model not configured]: There are currently ${context?.components?.length || 0} components and ${context?.connectionsCount || 0} wires on the board, with ${context?.issues?.length || 0} DRC issue(s). Check the DRC validation panel for details.`
          : `[Minibot Local Assistant – chưa cấu hình mô hình AI]: Hiện có ${context?.components?.length || 0} linh kiện và ${context?.connectionsCount || 0} dây nối trên bo mạch, ${context?.issues?.length || 0} cảnh báo DRC. Bạn có thể xem chi tiết ở bảng Kiểm tra luật mạch (DRC).`,
        source: 'local-fallback',
      });
    }

    const supportedList =
      'dc-source (vcc, gnd), resistor (pin1, pin2), led (anode, cathode), switch (pin1, pin2), potentiometer (pin1, wiper, pin2), connector (pin1, pin2), capacitor (pin_pos, pin_neg), diode (anode, cathode), buzzer (pin_pos, pin_neg), pushbutton (pin1, pin2), ldr (pin1, pin2)';
    const systemInstruction = (locale === 'en'
      ? `You are Minibot - the intelligent, pedagogically sound, and friendly AI Assistant for CircuitCraft 3D, a hardware circuit design and simulation platform.
Your mission:
- Guide users on fundamental electronic principles (Ohm's Law, LED polarity Anode/Cathode, current-limiting resistors, switches, potentiometers).
- Explain DRC validation errors (short circuits, missing current-limiting resistors, floating pins) using the circuit state provided in the user message.
- Maintain an encouraging pedagogical tone in fluent, concise, and practical English.
- When the user greets you, greet them warmly and introduce yourself as Minibot.
- Only reference components that exist in the library: ${supportedList}. Never invent pins or simulation capabilities.`
      : `Bạn là Minibot - Trợ lý ảo AI thông minh và thân thiện của nền tảng học tập thiết kế mạch điện 3D CircuitCraft.
Nhiệm vụ của bạn là:
- Hướng dẫn người dùng các nguyên lý điện tử cơ bản (Định luật Ohm, phân cực LED Anode/Cathode, bảo vệ quá dòng, công tắc, biến trở).
- Giải thích các lỗi thiết kế DRC (đoản mạch, LED thiếu điện trở hạn dòng, chân linh kiện chưa được nối) dựa trên TRẠNG THÁI MẠCH được gửi kèm trong tin nhắn.
- Giữ phong cách sư phạm, khích lệ, dùng tiếng Việt chuẩn mực, ngắn gọn và thực tiễn.
- Khi người dùng chào hỏi (ví dụ "hello", "chào bạn"), hãy đáp lại thân thiện, tự giới thiệu bạn là Minibot và sẵn sàng hỗ trợ thiết kế mạch 3D.
- Chỉ nhắc tới linh kiện có trong thư viện: ${supportedList}. Không tự bịa chân linh kiện hoặc khả năng mô phỏng.`) + describePracticeContext(context?.practiceContext);

    const contents: any[] = [];
    for (const h of history) {
      const role = h.role === 'assistant' ? 'model' : 'user';
      // Ensure conversation starts with user role and alternates (Gemini API requirement)
      if (contents.length === 0 && role === 'model') continue;
      const last = contents[contents.length - 1];
      if (last && last.role === role) {
        last.parts[0].text += `\n${h.content}`;
      } else {
        contents.push({ role, parts: [{ text: h.content }] });
      }
    }

    const userText = `${prompt}\n\n${describeCircuitContext(context)}`.trim();
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      // The latest user message from history is the same prompt: replace it with the enriched version
      const last = contents[contents.length - 1];
      last.parts[0].text = last.parts[0].text.endsWith(prompt) ? last.parts[0].text.slice(0, -prompt.length) + userText : `${last.parts[0].text}\n${userText}`;
    } else {
      contents.push({ role: 'user', parts: [{ text: userText }] });
    }

    const response = await generateWithGemini(ai, {
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || (locale === 'en' ? 'Hello! I am Minibot. How can I help you design your 3D circuit today?' : 'Chào bạn! Tôi là Minibot. Tôi có thể hỗ trợ gì cho bạn trong việc thiết kế mạch hôm nay?');
    res.json({ reply, source: 'gemini' });
  } catch (error: any) {
    console.error('Lỗi Gemini API chat:', error?.message || error);
    res.json({
      reply: locale === 'en'
        ? `[Minibot]: An issue occurred while connecting to the AI model. Please try again later!`
        : `[Minibot]: Đã xảy ra sự cố khi kết nối tới mô hình AI. Vui lòng thử lại sau ít phút!`,
      source: 'error',
    });
  }
});

// 2.1 Independent Website Support AI Chatbot
// Counted per verified user; guests per client address, with more room because a classroom or
// office can share one. Nothing in the request body influences the limit.
const SUPPORT_CHAT_USER_LIMIT = 25;
const SUPPORT_CHAT_GUEST_LIMIT = 60;

app.post('/api/support/chat', async (req, res) => {
  const { prompt, history, locale = 'vi' } = req.body;
  const lang = locale === 'en' ? 'en' : 'vi';

  const { limited } = await hitRateLimit(
    `support-chat:${rateLimitIdentity(req)}`,
    getAuthUser(req) ? SUPPORT_CHAT_USER_LIMIT : SUPPORT_CHAT_GUEST_LIMIT,
    60 * 1000
  );
  if (limited) {
    return res.status(429).json({
      reply: lang === 'en'
        ? 'You are sending messages too quickly. Please wait a moment before asking another question!'
        : 'Bạn đang gửi câu hỏi quá nhanh. Vui lòng đợi vài giây trước khi tiếp tục!',
    });
  }

  try {
    const ai = getGemini();

    const systemInstruction = lang === 'en'
      ? `You are the official CircuitCraft 3D Website Guide & Support Assistant.
Your mission is to welcome visitors, guide beginners, explain platform features, and help users navigate the website.
You are strictly INDEPENDENT from the 3D circuit simulation engine inside the CAD workspace.

Platform Knowledge:
- CircuitCraft 3D is a modern web application for interactive 3D electronic circuit design, real-time DC electrical simulation, and STEM learning.
- 3D Lab / Workspace: Features breadboard 2.54mm grid snapping, Arduino UNO R3, resistors, LEDs, switches, potentiometers, DC voltage sources, smooth Bezier wiring, 360° camera orbit, and Design Rule Checking (DRC) for short circuits.
- Interactive Courses: The Learning Academy offers structured courses like "UNO R3 - Fundamentals of Electronic Circuits" (8 practical chapters) by Huỳnh Phong, with live 3D labs.
- Marketplace: A community hub to explore, share, and clone pre-built circuit templates.
- Membership & Pricing: Free Student tier, Creator tier, and flexible memberships with seamless VietQR automated payment verification.
- In-workspace Minibot: A 3D companion dedicated to in-canvas circuit debugging and Ohm's Law calculations.

Navigation tags: When suggesting a section, you may include actionable tags such as [nav:projects] for 3D Lab, [nav:courses] for Courses, [nav:marketplace] for Marketplace, [nav:membership] for Membership plans.
Tone: Warm, encouraging, clear, and professional. Keep responses concise (under 160 words).`
      : `Bạn là Trợ lý Hỗ trợ & Hướng dẫn chính thức của website CircuitCraft 3D (Website Support AI).
Nhiệm vụ của bạn là chào đón khách truy cập, hướng dẫn người mới bắt đầu, giải thích tính năng nền tảng và hỗ trợ điều hướng trên website.
Bạn hoàn toàn ĐỘC LẬP với trợ lý Minibot phân tích mạch bên trong không gian CAD 3D.

Thông tin về nền tảng CircuitCraft 3D:
- CircuitCraft 3D là nền tảng thiết kế mạch điện tử 3D tương tác và mô phỏng điện học DC thời gian thực ngay trên trình duyệt web.
- Phòng thí nghiệm 3D (3D Lab): Cung cấp breadboard chuẩn 2.54mm, Arduino UNO R3, bóng LED, điện trở, công tắc gạt, chiết áp xoay, nguồn DC, hệ thống dây uốn Bezier mượt mà, xoay camera 360° và bộ kiểm tra luật thiết kế DRC phát hiện đoản mạch tức thì.
- Học viện Khóa học: Gồm các khóa học tương tác thực hành như "Khóa học UNO R3 - Mạch điện tử cơ bản" (8 chương bài bản) do giảng viên Huỳnh Phong phụ trách, kèm phòng lab 3D trực tiếp.
- Cửa hàng (Marketplace): Nơi cộng đồng chia sẻ, tải về và mở trực tiếp các bản vẽ mạch mẫu mã nguồn mở.
- Gói thành viên & Thanh toán: Gói Student miễn phí, gói Creator và các gói nâng cao với cổng thanh toán VietQR quét mã chuyển khoản tự động kích hoạt tức thì.
- Trợ lý Minibot: Robot 3D trong không gian thiết kế phục vụ gỡ lỗi mạch và hỗ trợ kỹ thuật chuyên sâu.

Điều hướng: Khi gợi ý người dùng đến tính năng tương ứng, bạn có thể kèm thẻ điều hướng như [nav:projects] (Vào Thiết kế 3D), [nav:courses] (Xem Khóa học), [nav:marketplace] (Vào Cửa hàng), [nav:membership] (Gói thành viên).
Phong cách: Thân thiện, chu đáo, súc tích, dễ hiểu cho người mới bắt đầu (dưới 160 từ).`;

    if (!ai) {
      // Smart offline fallback response
      const lower = (prompt || '').toLowerCase();
      let replyText = '';
      if (lower.includes('bắt đầu') || lower.includes('start') || lower.includes('làm sao')) {
        replyText = lang === 'en'
          ? 'To start building, click [nav:projects] to enter our 3D Workspace! You can drag components like Arduino, LEDs, and breadboards onto the board, connect wires, and press "Run Simulation".'
          : 'Để bắt đầu, bạn hãy nhấn [nav:projects] để vào Phòng thí nghiệm 3D! Bạn có thể kéo thả linh kiện (Arduino, LED, điện trở) lên bo mạch, nối dây và bấm "Chạy mô phỏng".';
      } else if (lower.includes('khóa học') || lower.includes('course') || lower.includes('học')) {
        replyText = lang === 'en'
          ? 'We offer beginner-friendly courses like "UNO R3 - Basic Circuits" with 8 interactive hands-on chapters. Visit [nav:courses] to explore the curriculum!'
          : 'Hệ thống có các khóa học thực hành như "Khóa học UNO R3 - Mạch điện tử cơ bản" gồm 8 chương từ thắp sáng LED đến vi điều khiển. Mời bạn ghé [nav:courses] để khám phá!';
      } else if (lower.includes('giá') || lower.includes('tiền') || lower.includes('membership') || lower.includes('price')) {
        replyText = lang === 'en'
          ? 'CircuitCraft 3D is free to get started for students! We also offer Creator & Pro packages with VietQR instant payment. Check out [nav:membership] for full details.'
          : 'CircuitCraft 3D miễn phí cho người học cơ bản! Ngoài ra có các gói Creator & Pro thanh toán tiện lợi qua VietQR. Bạn có thể xem tại [nav:membership].';
      } else {
        replyText = lang === 'en'
          ? 'Welcome to CircuitCraft 3D! I can help you find courses [nav:courses], explore the 3D lab [nav:projects], or learn about community projects in the [nav:marketplace]. What would you like to explore?'
          : 'Chào mừng bạn đến với CircuitCraft 3D! Tôi có thể hướng dẫn bạn vào [nav:projects] (Thiết kế 3D), khám phá [nav:courses] (Khóa học) hoặc ghé thăm [nav:marketplace] (Cửa hàng). Bạn cần hỗ trợ gì ạ?';
      }
      return res.json({ reply: replyText });
    }

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (!h.content) continue;
        const role = h.role === 'assistant' ? 'model' : 'user';
        if (contents.length === 0 && role === 'model') continue;
        contents.push({
          role,
          parts: [{ text: h.content }],
        });
      }
    }

    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += `\n${prompt}`;
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: prompt }],
      });
    }

    const response = await generateWithGemini(ai, {
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || (lang === 'en'
      ? 'Hello! I am your CircuitCraft Guide. How can I help you explore the platform today?'
      : 'Chào bạn! Tôi là Trợ lý Hướng dẫn CircuitCraft. Tôi có thể hỗ trợ gì cho bạn hôm nay?');

    res.json({ reply });
  } catch (error: any) {
    console.error('Lỗi Support AI chat:', error);
    res.json({
      reply: lang === 'en'
        ? `[CircuitCraft Guide]: I encountered a brief connection issue. You can easily start by clicking [nav:projects] or browsing our [nav:courses]!`
        : `[Trợ lý Hướng dẫn]: Kết nối AI tạm thời bị gián đoạn. Bạn có thể bắt đầu ngay bằng cách nhấn [nav:projects] để vào Thiết kế 3D hoặc xem [nav:courses] nhé!`,
    });
  }
});

// 3. AI Proposal Generator (structured JSON only; validated before it is returned)
const PROPOSAL_COMPONENT_IDS = ['dc-source', 'resistor', 'led', 'switch', 'potentiometer', 'capacitor', 'diode', 'buzzer', 'pushbutton', 'connector', 'ldr'];

function describeProposalLibrary(): string {
  return PROPOSAL_COMPONENT_IDS.map((id) => {
    const def = COMPONENT_DEFINITION_MAP.get(id);
    if (!def) return null;
    const params = Object.entries(def.defaultParameters || {})
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ');
    return `- "${id}" (${def.name}) pins: ${def.pins.map((p) => p.id).join(', ')}${params ? `; parameters mặc định: { ${params} }` : ''}`;
  })
    .filter(Boolean)
    .join('\n');
}

app.post('/api/ai/propose', rateLimit('ai-propose', 15, 60 * 1000), async (req, res) => {
  const requirement = String(req.body?.requirement || req.body?.prompt || '').slice(0, 2000);
  const baseRevision = Number(req.body?.baseRevision) || 0;
  const { context } = normalizeChatRequest({ prompt: requirement, context: req.body?.context, project: req.body?.project });

  if (!requirement.trim()) {
    return res.status(400).json({ error: 'Thiếu yêu cầu thiết kế.' });
  }

  try {
    const ai = getGemini();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API Key not configured', code: 'AI_UNCONFIGURED' });
    }

    const existingIds = (context?.components || []).map((c) => c.instanceId);
    const prompt = `Yêu cầu thiết kế: "${requirement}".
${context ? describeCircuitContext(context) : ''}

Hãy lập một đề xuất mạch điện tử bổ sung theo định dạng JSON.
CHỈ được dùng các linh kiện và đúng tên chân sau (không được tự đặt tên chân khác):
${describeProposalLibrary()}

Quy tắc:
- instanceId mới phải duy nhất và KHÔNG trùng với: ${JSON.stringify(existingIds)}.
- Dây nối có thể tham chiếu linh kiện mới hoặc linh kiện đã có trên mạch (dùng đúng instanceId).
- Luôn mắc điện trở hạn dòng nối tiếp với LED.
- Toạ độ position tính bằng mm trên mặt bo mạch (y = 0).

Trả về JSON duy nhất với cấu trúc:
{
  "proposalId": "string",
  "explanation": "giải thích ngắn bằng tiếng Việt",
  "layoutDescription": "mô tả bố trí 3D",
  "componentsToAdd": [
    { "instanceId": "ai-src-1", "definitionId": "dc-source", "name": "Nguồn 5V", "position": { "x": -40, "y": 0, "z": 0 }, "rotation": { "x": 0, "y": 0, "z": 0 }, "parameters": { "voltage": 5 } }
  ],
  "connectionsToAdd": [
    { "id": "ai-w-1", "fromComponentId": "ai-src-1", "fromPinId": "vcc", "toComponentId": "ai-r-1", "toPinId": "pin1", "wireColor": "#ef4444" }
  ]
}`;

    const response = await generateWithGemini(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    let parsed: any;
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      return res.status(502).json({ error: 'AI trả về dữ liệu không phải JSON hợp lệ.', code: 'AI_INVALID_JSON' });
    }
    parsed.baseRevision = baseRevision;
    parsed.source = 'ai';

    // Structural validation (component ids, pin ids, references). The client validates again
    // against the live document before showing the preview.
    const validation = validateAIProposal(parsed, null);
    if (!validation.valid || !validation.proposal) {
      return res.status(422).json({
        error: 'Đề xuất của AI không hợp lệ và đã bị từ chối.',
        code: 'AI_PROPOSAL_INVALID',
        errors: validation.errors,
      });
    }
    res.json({ proposal: validation.proposal, warnings: validation.warnings });
  } catch (error: any) {
    console.error('Lỗi sinh đề xuất mạch:', error?.message || error);
    res.status(500).json({ error: 'Không thể sinh đề xuất từ mô hình AI.' });
  }
});

// 3.1 AI Circuit Assistant (used by Minibot Copilot in Editor)
app.post('/api/ai/circuit-assistant', rateLimit('ai-assistant', 15, 60 * 1000), async (req, res) => {
  const { prompt, mode, circuitSnapshot } = req.body;
  const baseRevision = circuitSnapshot?.revision || 1;

  try {
    const ai = getGemini();
    if (ai) {
      const systemInstruction = `Bạn là Minibot AI Circuit Assistant trong CircuitCraft 3D.
Nhiệm vụ: Phân tích mạch điện và yêu cầu của người dùng, đưa ra đề xuất thay đổi mạch an toàn và khả thi.
Danh mục linh kiện được hỗ trợ:
- "dc-source" (pins: vcc, gnd; properties: { voltage: 5 })
- "resistor" (pins: pin1, pin2; properties: { resistance: 220 })
- "led" (pins: anode, cathode; properties: { color: "red" | "green" | "blue" | "yellow" })
- "switch" (pins: pin1, pin2)

Chỉ trả về JSON thuần túy (không kèm markdown format) với cấu trúc sau:
{
  "id": "prop-${Date.now()}",
  "baseRevision": ${baseRevision},
  "summary": "Tóm tắt ngắn (tiếng Việt)",
  "explanation": "Giải thích chi tiết nguyên lý (tiếng Việt)",
  "safetyCheckPassed": true,
  "changes": [
    {
      "action": "add_component" | "add_connection" | "update_property",
      "payload": { ... }
    }
  ]
}`;

      const userContent = `Yêu cầu: "${prompt}".\nChế độ: "${mode || 'suggest_fix'}".\nHiện trạng mạch: ${JSON.stringify(circuitSnapshot || {})}`;

      const geminiResponse = await generateWithGemini(ai, {
        contents: userContent,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const parsed = JSON.parse(geminiResponse.text || '{}');
      if (parsed.summary && Array.isArray(parsed.changes)) {
        parsed.id = parsed.id || `prop-${Date.now()}`;
        parsed.baseRevision = baseRevision;
        return res.json(parsed);
      }
    }
  } catch (error: any) {
    console.warn('Gemini circuit-assistant call failed, using intelligent fallback:', error?.message);
  }

  // Intelligent domain fallback
  const p = (prompt || '').toLowerCase();
  const hasLed = circuitSnapshot?.components?.some((c: any) => c.type === 'led');
  const hasResistor = circuitSnapshot?.components?.some((c: any) => c.type === 'resistor');

  let summary = 'Đề xuất cải tiến mạch';
  let explanation = 'Minibot đã phân tích mạch và đưa ra cấu hình tối ưu để đảm bảo an toàn.';
  const changes: any[] = [];

  if (p.includes('resistor') || p.includes('trở') || (hasLed && !hasResistor)) {
    summary = 'Thêm điện trở hạn dòng 220Ω bảo vệ LED';
    explanation = 'Đèn LED hoạt động ở dòng điện định mức ~15-20mA. Khi nối trực tiếp với nguồn 5V mà không có điện trở bảo vệ, dòng điện quá mức sẽ làm cháy LED. Điện trở 220Ω sẽ gánh điện áp dư và hạn dòng an toàn.';
    changes.push({
      action: 'add_component',
      payload: {
        type: 'resistor',
        name: 'Điện trở R1 (220Ω)',
        position: { x: 0, y: 0, z: -10 },
        properties: { resistance: 220 },
      },
    });
  } else if (p.includes('công tắc') || p.includes('switch')) {
    summary = 'Thêm công tắc gạt SPST điều khiển đóng ngắt';
    explanation = 'Công tắc SPST giúp bạn bật/tắt dòng điện thủ công mà không cần tháo nguồn.';
    changes.push({
      action: 'add_component',
      payload: {
        type: 'switch',
        name: 'Công tắc SW1',
        position: { x: -20, y: 0, z: -20 },
        properties: { state: 'closed' },
      },
    });
  } else {
    summary = 'Mạch đèn LED chuẩn an toàn 5V';
    explanation = 'Tạo vòng mạch kín tiêu chuẩn: Nguồn DC 5V -> Công tắc -> Điện trở bảo vệ 220Ω -> LED Đỏ -> GND.';
    changes.push(
      {
        action: 'add_component',
        payload: {
          type: 'dc-source',
          name: 'Nguồn DC 5V',
          position: { x: -40, y: 0, z: 0 },
          properties: { voltage: 5 },
        },
      },
      {
        action: 'add_component',
        payload: {
          type: 'resistor',
          name: 'Điện trở R1 (220Ω)',
          position: { x: 0, y: 0, z: -15 },
          properties: { resistance: 220 },
        },
      },
      {
        action: 'add_component',
        payload: {
          type: 'led',
          name: 'LED Đỏ',
          position: { x: 40, y: 0, z: 0 },
          properties: { color: 'red' },
        },
      }
    );
  }

  res.json({
    id: `prop-${Date.now()}`,
    baseRevision,
    summary,
    explanation,
    safetyCheckPassed: true,
    changes,
    isMockFallback: true,
  });
});

// 4. Projects Cloud Persistence & Status Endpoints

// 4.1 Server-side Catalog & Secure Orders/Payment Store
interface ServerProductItem {
  id: string;
  title: string;
  category: 'course' | 'project' | 'membership';
  authorName?: string;
  price: number; // strictly server-authoritative
  currency: string;
}

const SERVER_PRODUCTS: Record<string, ServerProductItem> = {
  // Courses
  'course-hoc-tap-mach-dien-tu-can-ban': {
    id: 'course-hoc-tap-mach-dien-tu-can-ban',
    title: 'Học tập mạch điện tử căn bản',
    category: 'course',
    authorName: 'Huỳnh Phong',
    price: 0,
    currency: 'VND',
  },
  // Marketplace Projects
  'mkt-555-pwm-dimmer': {
    id: 'mkt-555-pwm-dimmer',
    title: 'Mạch Điều Khiển Độ Rộng Xung PWM NE555 Công Suất Cao',
    category: 'project',
    authorName: 'KS. Vũ Minh Quân',
    price: 0,
    currency: 'VND',
  },
  'mkt-hbridge-l298-driver': {
    id: 'mkt-hbridge-l298-driver',
    title: 'Mạch Cầu H Đảo Chiều Động Cơ DC Kép Bảo Vệ Flyback',
    category: 'project',
    authorName: 'ThS. Trần Hoàng Nam',
    price: 129000,
    currency: 'VND',
  },
  'mkt-esp32-iot-weather-node': {
    id: 'mkt-esp32-iot-weather-node',
    title: 'Trạm Quan Trắc Môi Trường IoT Đa Cảm Biến Nguồn Kép',
    category: 'project',
    authorName: 'KS. Nguyễn Thành Luân',
    price: 185000,
    currency: 'VND',
  },
  'mkt-ads1115-afe-sensor': {
    id: 'mkt-ads1115-afe-sensor',
    title: 'Mạch Khuếch Đại & Lọc Nhiễu Tín Hiệu Cảm Biến Analog (AFE)',
    category: 'project',
    authorName: 'TS. Lê Đăng Khoa',
    price: 0,
    currency: 'VND',
  },
  'mkt-ch340g-usb-uart': {
    id: 'mkt-ch340g-usb-uart',
    title: 'Module Chuyển Đổi Giao Tiếp USB sang UART Cách Ly Quang',
    category: 'project',
    authorName: 'KS. Đỗ Gia Huy',
    price: 149000,
    currency: 'VND',
  },
  'mkt-tp4056-lipo-bms': {
    id: 'mkt-tp4056-lipo-bms',
    title: 'Mạch Sạc & Bảo Vệ Pin Lithium-Ion 1S Чуẩn Công Nghiệp',
    category: 'project',
    authorName: 'KS. Vũ Minh Quân',
    price: 89000,
    currency: 'VND',
  },
  'market-digital-alarm-clock': {
    id: 'market-digital-alarm-clock',
    title: 'Đồng Hồ Số LED Báo Thức Thông Minh (Alarm Clock 3D)',
    category: 'project',
    authorName: 'Huỳnh Phong',
    price: 79000,
    currency: 'VND',
  },
  'market-soil-moisture': {
    id: 'market-soil-moisture',
    title: 'Mạch Đo Độ Ẩm Đất & Tưới Cây Tự Động',
    category: 'project',
    authorName: 'Minh Tuấn IoT',
    price: 59000,
    currency: 'VND',
  },
  'market-robot-arm-4dof': {
    id: 'market-robot-arm-4dof',
    title: 'Mạch Điều Khiển Cánh Tay Robot 4 Bậc Tự Do Servo',
    category: 'project',
    authorName: 'Robotics Lab',
    price: 129000,
    currency: 'VND',
  },
  // Memberships
  'plan-student': {
    id: 'plan-student',
    title: 'Gói Học Viên STEM (Student Pro)',
    category: 'membership',
    price: MEMBERSHIP_PLAN_PRICES.student,
    currency: 'VND',
  },
  'plan-creator': {
    id: 'plan-creator',
    title: 'Gói Chuyên Gia Sáng Tạo (Creator Max)',
    category: 'membership',
    price: MEMBERSHIP_PLAN_PRICES.creator,
    currency: 'VND',
  },
};

// The official sample products live in the catalog shared with the client: the price charged is the
// price displayed, and the design used for the 3D preview is the one the buyer receives.
for (const item of CATALOG_PRODUCTS) {
  SERVER_PRODUCTS[item.id] = {
    id: item.id,
    title: item.name,
    category: 'project',
    authorName: item.author.name,
    price: item.price,
    currency: item.currency,
  };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders_store.json');
const ENTITLEMENTS_FILE = path.join(DATA_DIR, 'entitlements_store.json');

const serverOrdersStore = new Map<string, any>();
const serverEntitlementsStore = new Map<string, any>();

function loadOrdersAndEntitlements() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const storedOrders = readJsonFile<any[]>(ORDERS_FILE);
    if (Array.isArray(storedOrders)) {
      for (const o of storedOrders) {
        if (o && o.orderId) serverOrdersStore.set(o.orderId, o);
      }
    }
    const storedEntitlements = readJsonFile<any[]>(ENTITLEMENTS_FILE);
    if (Array.isArray(storedEntitlements)) {
      for (const e of storedEntitlements) {
        if (e && e.userId && e.productId) {
          serverEntitlementsStore.set(`${e.userId}_${e.productId}`, e);
        }
      }
    }
  } catch (err) {
    console.warn('[Server] Error loading orders/entitlements:', err);
  }
}

function saveOrdersToDisk() {
  if (isRemotePersistence()) {
    saveCollection('orders', serverOrdersStore.entries());
    return;
  }
  try {
    writeJsonAtomic(ORDERS_FILE, Array.from(serverOrdersStore.values()));
  } catch (err) {
    console.warn('[Server] Error saving orders:', err);
  }
}

function saveEntitlementsToDisk() {
  if (isRemotePersistence()) {
    saveCollection('entitlements', serverEntitlementsStore.entries());
    return;
  }
  try {
    writeJsonAtomic(ENTITLEMENTS_FILE, Array.from(serverEntitlementsStore.values()));
  } catch (err) {
    console.warn('[Server] Error saving entitlements:', err);
  }
}

if (getPersistenceMode() === 'file') {
  loadOrdersAndEntitlements();
} else {
  const applyRows = (store: Map<string, any>) => (rows: Array<{ id: string; data: any; deleted: boolean }>) => {
    for (const row of rows) {
      if (row.deleted) store.delete(row.id);
      else store.set(row.id, row.data);
    }
  };
  registerCollection('orders', applyRows(serverOrdersStore));
  registerCollection('entitlements', applyRows(serverEntitlementsStore));
}

/**
 * Whether a user holds a product. What a simulated checkout granted counts only while the system runs
 * in mock mode: switching to real payments never turns demo purchases into real access.
 */
function hasEntitlement(userId: string, productId: string): boolean {
  const entitlement = serverEntitlementsStore.get(`${userId}_${productId}`);
  if (!entitlement) return false;
  return getPaymentMode() === 'mock' || !isSimulatedEntitlement(entitlement);
}

function isSimulatedEntitlement(entitlement: any): boolean {
  if (entitlement.isMock === true) return true;
  const order = entitlement.orderId ? serverOrdersStore.get(entitlement.orderId) : null;
  return Boolean(order) && Number(order.amount) > 0 && isMockOrder(order);
}

/** A tier obtained through a simulated checkout does not exist once real payments are on. */
function tierIsReal(user: { tierGrantedByMock?: boolean }): boolean {
  return getPaymentMode() === 'mock' || !user.tierGrantedByMock;
}

// Strict Server-Side Admin Authorization Middleware (identity comes only from a verified Bearer token)
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized: Vui lòng đăng nhập tài khoản Quản trị viên.',
      code: 'UNAUTHORIZED',
    });
  }
  if (!isAdminUser(user)) {
    addSystemLog({
      level: 'warning',
      category: 'admin',
      action: 'UNAUTHORIZED_ADMIN_ACCESS',
      actorId: user.id,
      actorEmail: user.email,
      details: `Từ chối truy cập trái phép vào API Admin (${req.method} ${req.originalUrl}) từ ${user.email}`,
    });
    return res.status(403).json({
      error: 'Forbidden: Bạn không có quyền truy cập khu vực Quản trị hệ thống.',
      code: 'FORBIDDEN',
    });
  }
  (req as any).adminUser = user;
  next();
}

// Helper to verify Creator Entitlement on Server (Server Authoritative)
function isCreatorUser(userId: string): boolean {
  if (!userId) return false;
  const user = getUserById(userId) || getUserByEmail(userId);
  if (user && isVerifiedAdminEmail(user.email, Boolean(user.verifiedAt))) return true;
  if (user && tierIsReal(user) && (user.tier === 'creator' || user.role === 'creator')) return true;
  if (user && hasEntitlement(user.id, 'plan-creator')) return true;
  return hasEntitlement(userId, 'plan-creator');
}

/**
 * Resolves the acting creator for creator-only routes.
 * The creator identity is always the authenticated user; a `creatorId`/`userId` in the request
 * must match it (admins may act on behalf of another creator).
 */
function resolveActingCreator(req: express.Request, res: express.Response): string | null {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'Vui lòng đăng nhập tài khoản Nhà sáng tạo.', code: 'UNAUTHORIZED' });
    return null;
  }
  const claimed = (req.body?.creatorId || req.body?.userId || req.query?.userId) as string | undefined;
  let creatorId = user.id;
  if (claimed && claimed !== user.id && claimed.toLowerCase() !== user.email.toLowerCase()) {
    if (!isAdminUser(user)) {
      res.status(403).json({ success: false, error: 'Không được thao tác dưới danh nghĩa Nhà sáng tạo khác.', code: 'FORBIDDEN' });
      return null;
    }
    creatorId = claimed;
  }
  if (!isCreatorUser(creatorId)) {
    res.status(403).json({
      success: false,
      error: 'Tài khoản chưa kích hoạt gói Nhà sáng tạo (Creator). Vui lòng nâng cấp gói để sử dụng chức năng này.',
      code: 'CREATOR_REQUIRED',
    });
    return null;
  }
  return creatorId;
}

/** Owner of a creator resource (product/course) or an admin. */
function canManageCreatorResource(req: express.Request, ownerId: string | undefined): boolean {
  const user = getAuthUser(req);
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return Boolean(ownerId) && (ownerId === user.id || ownerId!.toLowerCase() === user.email.toLowerCase());
}

/** Whether the authenticated user owns (or bought) a product's full design. */
function canAccessFullProduct(req: express.Request, productId: string): boolean {
  const product = creatorStore.getProduct(productId);
  const price = product ? product.price : CATALOG_PRODUCTS.find((c) => c.id === productId)?.price;
  if (price === 0) return true;
  const user = getAuthUser(req);
  if (!user) return false;
  if (canManageCreatorResource(req, product?.creatorId)) return true;
  return hasEntitlement(user.id, productId);
}

function courseIsFree(courseId: string): boolean {
  const course = creatorStore.getCourse(courseId);
  if (course) return Number(course.price) === 0;
  const listed = SERVER_PRODUCTS[courseId];
  return listed ? Number(listed.price) === 0 : true; // built-in free courses are not priced server-side
}

/** Lessons of a paid course: its owner, an admin or a buyer. Free courses are open to everyone. */
function canAccessCourseContent(req: express.Request, courseId: string): boolean {
  if (courseIsFree(courseId)) return true;
  const user = getAuthUser(req);
  if (!user) return false;
  if (canManageCreatorResource(req, creatorStore.getCourse(courseId)?.creatorId)) return true;
  return hasEntitlement(user.id, courseId);
}

function courseWithSignedMedia<T extends { syllabus?: unknown; chapters?: unknown }>(course: T): T {
  return { ...course, syllabus: withSignedSlideImages(course.syllabus), chapters: withSignedSlideImages(course.chapters) };
}

// 4.2 Catalog Endpoints
// The public list carries what a visitor needs to decide on a course. Slides, practice circuits and
// video links are only available from /api/courses/:id/content.
app.get('/api/courses', (_req, res) => {
  const courses = creatorStore.listPublishedCourses().map((c: any) => ({
    ...courseSummary(c),
    author: { name: c.creatorName || 'Huỳnh Phong' },
  }));
  res.json({ success: true, courses });
});

app.get('/api/courses/:id/content', (req, res) => {
  const course = creatorStore.getCourse(req.params.id);
  const canManage = canManageCreatorResource(req, course?.creatorId);
  if (!course || (course.status !== 'PUBLISHED' && !canManage)) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy khóa học', code: 'COURSE_NOT_FOUND' });
  }
  if (!canAccessCourseContent(req, course.id)) {
    const signedIn = Boolean(getAuthUser(req));
    return res.status(signedIn ? 403 : 401).json({
      success: false,
      error: signedIn ? 'Bạn cần mua khóa học để xem nội dung này.' : 'Vui lòng đăng nhập để xem nội dung khóa học.',
      code: signedIn ? 'PAYMENT_REQUIRED' : 'UNAUTHORIZED',
    });
  }
  res.json({
    success: true,
    course: { ...courseWithSignedMedia(course as any), author: { name: (course as any).creatorName || 'Huỳnh Phong' } },
  });
});

// All published Marketplace products (system + creator products)
app.get('/api/products/catalog', (req, res) => {
  const creatorProducts = creatorStore.listPublishedProducts();
  res.json({ success: true, products: creatorProducts });
});

app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const creatorProduct = creatorStore.getProduct(id);
  if (creatorProduct) {
    return res.json({ product: creatorProduct });
  }

  const staticProduct = SERVER_PRODUCTS[id];
  if (staticProduct) {
    return res.json({ product: staticProduct });
  }

  return res.status(404).json({ error: 'Sản phẩm không tồn tại trên máy chủ' });
});

// Read-only 3D preview built from the product's real design, either the creator's published version
// or the shared catalog template. Without design data the preview is reported as unavailable.
app.get('/api/products/:id/preview', (req, res) => {
  const { id } = req.params;
  const product = creatorStore.getProduct(id);
  const catalogItem = CATALOG_PRODUCTS.find((c) => c.id === id);
  if (!product && !catalogItem) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm', code: 'PRODUCT_NOT_FOUND' });
  }
  if (product && product.status !== 'PUBLISHED' && !canManageCreatorResource(req, product.creatorId)) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm', code: 'PRODUCT_NOT_FOUND' });
  }

  const latestVer = creatorStore.getLatestVersionForProduct(id);
  const snapshot =
    latestVer?.previewSnapshot ||
    (CATALOG_DESIGNS[id] ? creatorStore.generatePublicPreviewSnapshot(CATALOG_DESIGNS[id]()) : null);
  if (!snapshot || !Array.isArray(snapshot.components) || snapshot.components.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Sản phẩm này chưa có dữ liệu thiết kế để xem trước 3D.',
      code: 'PREVIEW_UNAVAILABLE',
    });
  }

  // Before purchase a paid design only shows which parts sit where: no wiring and no values,
  // so the preview cannot be turned back into the product.
  const price = product?.price ?? catalogItem?.price ?? 0;
  const preview = price > 0 && !canAccessFullProduct(req, id) ? publicPreviewOnly(snapshot) : snapshot;

  res.json({
    success: true,
    productId: id,
    title: product?.title || catalogItem?.name,
    version: latestVer?.version || product?.currentVersionNumber || catalogItem?.version || '1.0.0',
    preview,
  });
});

// The complete design: free products for everyone, paid products for buyers, the creator and admins.
app.get('/api/products/:id/design', (req, res) => {
  const { id } = req.params;
  const product = creatorStore.getProduct(id);
  const catalogDesign = CATALOG_DESIGNS[id];
  const canManage = canManageCreatorResource(req, product?.creatorId);
  if ((!product && !catalogDesign) || (product && product.status !== 'PUBLISHED' && !canManage)) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm', code: 'PRODUCT_NOT_FOUND' });
  }
  if (!canAccessFullProduct(req, id)) {
    const signedIn = Boolean(getAuthUser(req));
    return res.status(signedIn ? 403 : 401).json({
      success: false,
      error: signedIn ? 'Bạn cần mua sản phẩm này để mở bản thiết kế.' : 'Vui lòng đăng nhập để mở bản thiết kế.',
      code: signedIn ? 'PAYMENT_REQUIRED' : 'UNAUTHORIZED',
    });
  }
  const design = creatorStore.getLatestVersionForProduct(id)?.projectSnapshot || catalogDesign?.();
  if (!design) {
    return res.status(404).json({ success: false, error: 'Sản phẩm này chưa có bản thiết kế.', code: 'DESIGN_UNAVAILABLE' });
  }
  res.json({ success: true, productId: id, design });
});

const PENDING_ORDER_REUSE_MS = 30 * 60 * 1000;

// 4.3 Secure Order Creation (Unified Checkout - VietQR for Memberships, Courses, and Marketplace Projects)
app.post('/api/orders/create', requireAuth, (req, res) => {
  const authUser = getAuthUser(req)!;
  const { productId, courseId, planId } = req.body;
  const targetId = String(productId || courseId || planId || '').trim();
  if (!targetId) {
    return res.status(400).json({ error: 'Thiếu mã sản phẩm cần thanh toán.' });
  }
  const paymentMode = getPaymentMode();
  let priceSource: 'server' | 'client-unverified' = 'server';
  let targetTitle = '';
  let targetPrice = 0;
  let targetCurrency: 'VND' = 'VND';
  let authorName = 'CircuitCraft 3D';
  let creatorId: string | undefined = undefined;
  let orderType: 'project' | 'course' | 'membership' = 'project';

  // 1. Check Creator Store Products
  let creatorProduct = creatorStore.getProduct(targetId);
  if (!creatorProduct && targetId) {
    const unprefix = targetId.replace(/^(course-|market-|plan-|prod-|mkt-)/, '');
    creatorProduct = creatorStore.getProduct(unprefix) || creatorStore.getProduct(`prod-${unprefix}`);
  }

  if (creatorProduct) {
    targetTitle = creatorProduct.title;
    targetPrice = creatorProduct.price;
    targetCurrency = creatorProduct.currency;
    authorName = creatorProduct.creatorName;
    creatorId = creatorProduct.creatorId;
    orderType = 'project';
  } else {
    // 2. Check Creator Store Courses
    const creatorCourse = creatorStore.getCourse(targetId);
    if (creatorCourse) {
      targetTitle = creatorCourse.title;
      targetPrice = creatorCourse.price;
      targetCurrency = creatorCourse.currency;
      authorName = creatorCourse.creatorName;
      creatorId = creatorCourse.creatorId;
      orderType = 'course';
    } else {
      // 3. Check SERVER_PRODUCTS
      let serverProd = SERVER_PRODUCTS[targetId];
      if (!serverProd && targetId) {
        serverProd = SERVER_PRODUCTS[`prod-${targetId}`] ||
          SERVER_PRODUCTS[`course-${targetId}`] ||
          SERVER_PRODUCTS[`mkt-${targetId}`] ||
          SERVER_PRODUCTS[targetId.replace(/^(course-|market-|plan-|prod-|mkt-)/, '')];
      }

      if (serverProd) {
        targetTitle = serverProd.title;
        targetPrice = serverProd.price;
        targetCurrency = serverProd.currency as any;
        authorName = serverProd.authorName || 'Huỳnh Phong';
        orderType = serverProd.category as any;
        if (targetId.startsWith('plan-') || targetId === 'student' || targetId === 'creator') orderType = 'membership';
      } else if (paymentMode === 'mock' && (req.body.productTitle || req.body.productName || req.body.title)) {
        // Catalog items that only exist in the client catalog: accepted ONLY for simulated
        // checkout (no money moves). In real payment mode the server price is mandatory.
        priceSource = 'client-unverified';
        targetTitle = req.body.productTitle || req.body.productName || req.body.title;
        targetPrice = Number(req.body.amount || req.body.price || 0);
        targetCurrency = 'VND';
        authorName = req.body.authorName || 'Huỳnh Phong';
        orderType = targetId.startsWith('course') ? 'course' : targetId.startsWith('plan') ? 'membership' : 'project';
      }
    }
  }

  if (!targetTitle) {
    return res.status(404).json({
      error: `Sản phẩm "${targetId}" không tồn tại trên hệ thống máy chủ.`,
    });
  }

  // Authoritative server pricing
  const amount = targetPrice;

  // Already owned: the existing purchase is returned, nothing is sold twice
  const ownOrders = Array.from(serverOrdersStore.values()).filter((o) => o.userId === authUser.id && o.productId === targetId);
  if (amount > 0 && hasEntitlement(authUser.id, targetId)) {
    const paidOrder = ownOrders.find((o) => o.status === 'paid');
    if (paidOrder) return res.json({ success: true, order: paidOrder, alreadyOwned: true });
  }
  // A repeated click, or a second tab, continues the same checkout
  const openOrder = ownOrders.find(
    (o) => o.status === 'pending' && o.amount === amount && o.paymentMode === paymentMode && Date.now() - new Date(o.createdAt).getTime() < PENDING_ORDER_REUSE_MS
  );
  if (openOrder) return res.json({ success: true, order: openOrder });

  // The id comes from the buyer, product and how many orders they had: two instances handling the same
  // click at once produce one record instead of two.
  const orderHash = crypto.createHash('sha256').update(`${authUser.id}|${targetId}|${ownOrders.length}`).digest('hex');
  const shortCode = (parseInt(orderHash.slice(0, 8), 16) % 9000) + 1000;
  const cleanCode = targetId.replace(/^(course-|market-|plan-|prod-)/, '').toUpperCase().substring(0, 8);
  const orderCode = `CC3D_${cleanCode}_${shortCode}`;
  const orderId = `ord-${orderHash.slice(0, 24)}`;
  const nowIso = new Date().toISOString();

  // Recipient details. The simulated checkout always shows a placeholder account, even when real bank
  // settings exist; real mode refuses to invent one, so nobody can transfer money to a wrong account.
  const isSimulated = paymentMode === 'mock';
  if (!isSimulated && amount > 0 && !process.env.PAYMENT_ACCOUNT_NUMBER?.trim()) {
    return res.status(503).json({
      success: false,
      error: 'Hệ thống chưa cấu hình tài khoản nhận thanh toán.',
      code: 'PAYMENT_NOT_CONFIGURED',
    });
  }
  const accountName = isSimulated ? 'CIRCUITCRAFT DEMO' : process.env.PAYMENT_ACCOUNT_NAME?.trim() || 'CircuitCraft 3D';
  const bankName = isSimulated ? 'Ngân hàng mô phỏng' : process.env.PAYMENT_BANK_NAME?.trim() || 'MB Bank';
  const bankId = isSimulated ? '970422' : process.env.PAYMENT_BANK_ID?.trim() || '970422';
  const accountNumber = isSimulated ? '0000000000' : process.env.PAYMENT_ACCOUNT_NUMBER!.trim();
  const transferContent = `CC3D ${orderCode}`;

  const encodedAccountName = encodeURIComponent(accountName);
  const encodedContent = encodeURIComponent(transferContent);
  // The simulated checkout has no QR: nothing goes to an outside service and nothing can be scanned and paid
  const qrUrl = isSimulated
    ? ''
    : `https://api.vietqr.io/image/${bankId}-${accountNumber}-compact.jpg?accountName=${encodedAccountName}&amount=${amount}&addInfo=${encodedContent}`;

  const bankDetails = {
    bankName,
    bankId,
    accountNumber,
    accountNumberMasked: accountNumber.length > 4 ? `${accountNumber.slice(0, 3)}****${accountNumber.slice(-3)}` : accountNumber,
    accountName,
    orderCode,
    transferContent,
    amount,
    currency: targetCurrency,
    qrUrl,
  };

  const order = {
    orderId,
    orderCode,
    productId: targetId,
    productTitle: targetTitle,
    author: authorName,
    amount,
    currency: targetCurrency,
    status: amount === 0 ? 'paid' : 'pending',
    paymentMethod: amount === 0 ? 'Free' : paymentMode === 'mock' ? 'VietQR (Mô phỏng)' : 'VietQR',
    paymentMode,
    isMock: paymentMode === 'mock',
    priceSource,
    userId: authUser.id,
    userEmail: authUser.email,
    creatorId,
    orderType,
    bankDetails,
    createdAt: nowIso,
    paidAt: amount === 0 ? nowIso : undefined,
  };

  serverOrdersStore.set(orderId, order);
  saveOrdersToDisk();

  addSystemLog({
    level: 'info',
    category: 'payment',
    action: 'ORDER_CREATED',
    actorId: order.userId,
    actorEmail: order.userEmail,
    targetId: order.orderCode,
    details: `Tạo đơn hàng ${order.orderCode} cho "${order.productTitle}" (${order.amount.toLocaleString('vi-VN')} VND)`,
  });

  // If free product, grant entitlement immediately
  if (amount === 0) {
    serverEntitlementsStore.set(`${order.userId}_${order.productId}`, {
      userId: order.userId,
      userEmail: order.userEmail,
      productId: order.productId,
      productTitle: order.productTitle,
      orderId: order.orderId,
      grantedAt: nowIso,
    });
    saveEntitlementsToDisk();
    if (orderType === 'course') {
      recordCourseEnrollment({
        userId: order.userId,
        userEmail: order.userEmail,
        courseId: order.productId,
        courseTitle: order.productTitle,
      });
    }
  }

  res.json({ success: true, order });
});

// 4.4 Order Status (owner or admin only)
function sendOwnedOrderStatus(req: express.Request, res: express.Response, orderId: string) {
  const order = serverOrdersStore.get(orderId);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (!isSelfOrAdmin(getAuthUser(req), order.userId)) {
    return res.status(403).json({ error: 'Bạn không có quyền xem đơn hàng này.', code: 'FORBIDDEN' });
  }
  res.json({ status: order.status, order, paymentMode: getPaymentMode() });
}

app.get('/api/orders/:orderId/status', requireAuth, (req, res) => {
  sendOwnedOrderStatus(req, res, req.params.orderId);
});

app.get('/api/orders/status', requireAuth, (req, res) => {
  const orderId = req.query.orderId as string;
  if (!orderId) return res.status(400).json({ error: 'Thiếu orderId' });
  sendOwnedOrderStatus(req, res, orderId);
});

// 4.4b Multi-user isolated orders query
app.get('/api/orders/user/:userId', requireAuth, (req, res) => {
  const authUser = getAuthUser(req)!;
  const { userId } = req.params;
  if (!isSelfOrAdmin(authUser, userId)) {
    return res.status(403).json({ error: 'Bạn chỉ được xem đơn hàng của chính mình.', code: 'FORBIDDEN' });
  }
  const targetId = isAdminUser(authUser) ? userId : authUser.id;
  const userOrders = Array.from(serverOrdersStore.values())
    .filter((o) => o.userId === targetId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ orders: userOrders });
});

// Payment configuration for the checkout UI (read-only; the client can never switch modes)
app.get('/api/payments/config', (_req, res) => {
  const mode = getPaymentMode();
  res.json({ mode, mockEnabled: mode === 'mock' });
});

/**
 * Marks an order as paid and grants the entitlement. Idempotent: confirming an already paid
 * order never duplicates entitlements, sales or logs. Callers must have authorised the action.
 */
function settleOrderAsPaid(order: any) {
  const wasPending = order.status !== 'paid';
  if (wasPending) {
    order.status = 'paid';
    order.paidAt = new Date().toISOString();
    serverOrdersStore.set(order.orderId, order);
    saveOrdersToDisk();
  }

  const entKey = `${order.userId}_${order.productId}`;
  const entitlement = serverEntitlementsStore.get(entKey) || {
    userId: order.userId,
    userEmail: order.userEmail,
    productId: order.productId,
    productTitle: order.productTitle,
    orderId: order.orderId,
    grantedAt: order.paidAt,
    isMock: isMockOrder(order),
  };
  if (!serverEntitlementsStore.has(entKey)) {
    serverEntitlementsStore.set(entKey, entitlement);
    saveEntitlementsToDisk();
  }

  if (wasPending) {
    // If Creator or Student plan purchased, elevate user tier on server
    if (order.productId === 'plan-creator') {
      updateUserTier(order.userId, 'creator', { mock: isMockOrder(order) });
    } else if (order.productId === 'plan-student') {
      updateUserTier(order.userId, 'student', { mock: isMockOrder(order) });
    }

    if (order.orderType === 'course' || String(order.productId).startsWith('course-')) {
      recordCourseEnrollment({
        userId: order.userId,
        userEmail: order.userEmail || getUserById(order.userId)?.email || 'user@circuitcraft.io',
        courseId: order.productId,
        courseTitle: order.productTitle,
      });
    }

    // If creator item purchased, record sale in creator store for Gross Sales tracking
    if (order.creatorId) {
      creatorStore.recordSale({
        orderId: order.orderId,
        orderCode: order.orderCode,
        creatorId: order.creatorId,
        productId: order.productId,
        productTitle: order.productTitle,
        buyerUserId: order.userId,
        buyerEmail: order.userEmail,
        unitPrice: order.amount,
        currency: 'VND',
        type: order.orderType || 'project',
        isMock: isMockOrder(order),
      });
    }

    addSystemLog({
      level: 'success',
      category: 'payment',
      action: isMockOrder(order) ? 'ORDER_PAID_MOCK' : 'ORDER_PAID',
      actorId: order.userId,
      actorEmail: order.userEmail,
      targetId: order.orderCode,
      details: `${isMockOrder(order) ? '[MÔ PHỎNG] ' : ''}Thanh toán thành công đơn hàng ${order.orderCode} - "${order.productTitle}" (${Number(order.amount || 0).toLocaleString('vi-VN')} VND)`,
    });
  }

  return { entitlement, wasPending };
}

// 4.5 Simulated payment confirmation (MOCK mode only, order owner only)
const handleMockOrderVerification = (req: express.Request, res: express.Response, orderId: string) => {
  const order = serverOrdersStore.get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Không tìm thấy đơn hàng trên máy chủ.' });
  }
  const authUser = getAuthUser(req)!;
  if (order.userId !== authUser.id) {
    return res.status(403).json({ success: false, error: 'Bạn không thể xác nhận đơn hàng của người khác.', code: 'FORBIDDEN' });
  }

  if (order.status === 'paid') {
    // Idempotent re-confirmation
    const { entitlement } = settleOrderAsPaid(order);
    return res.json({
      success: true,
      order,
      entitlement,
      isMock: isMockOrder(order),
      message: `Đơn hàng ${order.orderCode} đã được thanh toán trước đó.`,
    });
  }

  if (!isMockPaymentAllowed() || !isMockOrder(order)) {
    return res.status(409).json({
      success: false,
      status: order.status,
      paymentMode: getPaymentMode(),
      error: 'Hệ thống đang ở chế độ thanh toán thật: đơn hàng chỉ được xác nhận khi có bằng chứng thanh toán hợp lệ.',
      code: 'MOCK_PAYMENT_DISABLED',
    });
  }

  const { entitlement } = settleOrderAsPaid(order);
  return res.json({
    success: true,
    order,
    entitlement,
    isMock: true,
    message: `[Thanh toán mô phỏng] Đã xác nhận đơn hàng ${order.orderCode}. Quyền truy cập "${order.productTitle}" đã được kích hoạt (không có giao dịch tiền thật).`,
  });
};

app.post('/api/orders/:orderId/verify', requireAuth, (req, res) => {
  handleMockOrderVerification(req, res, req.params.orderId);
});

app.post('/api/orders/mock-verify', requireAuth, (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Thiếu mã đơn hàng orderId' });
  handleMockOrderVerification(req, res, orderId);
});

// 4.6 User Entitlements Check (self or admin)
app.get('/api/entitlements/:userId', requireAuth, (req, res) => {
  const authUser = getAuthUser(req)!;
  const { userId } = req.params;
  if (!isSelfOrAdmin(authUser, userId)) {
    return res.status(403).json({ error: 'Bạn chỉ được xem quyền truy cập của chính mình.', code: 'FORBIDDEN' });
  }
  const targetId = isAdminUser(authUser) ? userId : authUser.id;
  const list = Array.from(serverEntitlementsStore.values()).filter(
    (e) => e.userId === targetId && hasEntitlement(e.userId, e.productId)
  );
  res.json({ entitlements: list });
});

// AI Endpoint 1: Automatically split Creator's uploaded Practice Project into 3 stages (Thêm thiết bị/mạch -> Nối dây -> Chạy mô phỏng)
app.post('/api/courses/analyze-practice-project', rateLimit('ai-practice', 10, 60 * 1000), async (req, res) => {
  const { project, lessonTitle, shortDescription, baseStages } = req.body;
  try {
    const ai = getGemini();
    if (!ai || !project) {
      return res.json({
        success: true,
        stages: baseStages || [],
        summary: shortDescription || `Bài thực hành: ${lessonTitle}`,
      });
    }

    const comps = (project.components || []).map((c: any) => ({
      id: c.instanceId,
      name: c.name,
      type: c.definitionId,
      parameters: c.parameters,
    }));
    const conns = (project.connections || []).map((cn: any) => ({
      from: `${cn.fromComponentId}.${cn.fromPinId}`,
      to: `${cn.toComponentId}.${cn.toPinId}`,
    }));

    const promptText = `Hãy phân tích dự án mạch điện 3D của giảng viên cho bài thực hành "${lessonTitle || 'Thực hành mạch 3D'}" (Mô tả: "${shortDescription || ''}").
Danh sách linh kiện (${comps.length}): ${JSON.stringify(comps)}
Danh sách dây nối (${conns.length}): ${JSON.stringify(conns)}

Hãy tách bài thực hành này thành ĐÚNG 3 giai đoạn rõ ràng cho học sinh làm theo từ bo mạch trống:
- Giai đoạn 1: Thêm thiết bị & Linh kiện lên mạch
- Giai đoạn 2: Nối dây mạch điện
- Giai đoạn 3: Chạy mô phỏng & Kiểm tra kết quả

Trả về JSON hợp lệ với cấu trúc:
{
  "summary": "Tóm tắt mục tiêu và nguyên lý bài thực hành trong 2 câu dễ hiểu",
  "stage1Description": "Hướng dẫn ngắn gọn cho giai đoạn 1",
  "stage1Steps": ["Bước 1.1: ...", "Bước 1.2: ..."],
  "stage2Description": "Hướng dẫn ngắn gọn cho giai đoạn 2",
  "stage2Steps": ["Bước 2.1: ...", "Bước 2.2: ..."],
  "stage3Description": "Hướng dẫn ngắn gọn cho giai đoạn 3",
  "stage3Steps": ["Bước 3.1: ...", "Bước 3.2: ..."]
}`;

    const response = await generateWithGemini(ai, {
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const enrichedStages = Array.isArray(baseStages) && baseStages.length === 3
      ? [
          {
            ...baseStages[0],
            description: parsed.stage1Description || baseStages[0].description,
            steps: Array.isArray(parsed.stage1Steps) && parsed.stage1Steps.length > 0 ? parsed.stage1Steps : baseStages[0].steps,
          },
          {
            ...baseStages[1],
            description: parsed.stage2Description || baseStages[1].description,
            steps: Array.isArray(parsed.stage2Steps) && parsed.stage2Steps.length > 0 ? parsed.stage2Steps : baseStages[1].steps,
          },
          {
            ...baseStages[2],
            description: parsed.stage3Description || baseStages[2].description,
            steps: Array.isArray(parsed.stage3Steps) && parsed.stage3Steps.length > 0 ? parsed.stage3Steps : baseStages[2].steps,
          },
        ]
      : baseStages;

    res.json({
      success: true,
      stages: enrichedStages,
      summary: parsed.summary || shortDescription || `Bài thực hành: ${lessonTitle}`,
    });
  } catch (err) {
    res.json({
      success: true,
      stages: baseStages || [],
      summary: shortDescription || `Bài thực hành: ${lessonTitle}`,
    });
  }
});

// AI Endpoint 2: Dedicated Theory Slide AI Teaching Assistant (Trợ giảng AI Lý thuyết)
app.post('/api/courses/theory-tutor', rateLimit('ai-tutor', 30, 60 * 1000), async (req, res) => {
  const {
    courseTitle,
    courseDescription,
    lessonTitle,
    lessonSummary,
    currentSlideNumber,
    currentSlide,
    allSlides,
    courseSyllabusSummary,
    prompt,
    history,
  } = req.body;

  try {
    const ai = getGemini();
    const slideDeckText = Array.isArray(allSlides)
      ? allSlides
          .map(
            (s: any) =>
              `[Slide ${s.slideNumber}: ${s.title}]\nNội dung: ${(s.bullets || []).join('; ') || s.contentText || ''}${
                s.notes ? `\nGhi chú: ${s.notes}` : ''
              }`
          )
          .join('\n\n')
      : '';

    const currentSlideText = currentSlide
      ? `Slide số ${currentSlide.slideNumber}/${Array.isArray(allSlides) ? allSlides.length : 1}: "${currentSlide.title}"\nNội dung trên slide này:\n${(
          currentSlide.bullets || []
        )
          .map((b: string) => `- ${b}`)
          .join('\n')}${currentSlide.notes ? `\nGhi chú giảng viên: ${currentSlide.notes}` : ''}`
      : `Slide số ${currentSlideNumber || 1}`;

    if (!ai) {
      // Intelligent slide-aware local tutor response
      const reply = `**[Trợ giảng AI Lý thuyết — Đang theo dõi Slide ${currentSlide?.slideNumber || 1}: "${currentSlide?.title || lessonTitle}"]**\n\nTại slide này, nội dung trọng tâm là:\n${
        (currentSlide?.bullets || []).map((b: string) => `• ${b}`).join('\n') || currentSlide?.contentText || lessonSummary
      }\n\n💡 **Giải thích thêm cho câu hỏi của bạn:**\nNội dung này nằm trong bài *"${lessonTitle}"* thuộc khóa học *"${courseTitle}"* (tổng cộng ${
        Array.isArray(allSlides) ? allSlides.length : 1
      } slide). Bạn có thể chuyển qua các slide tiếp theo hoặc hỏi bất kỳ khái niệm nào trên slide để mình phân tích sâu hơn nhé!`;
      return res.json({ success: true, reply });
    }

    const systemInstruction = `Bạn là Trợ giảng AI Lý thuyết (AI Teaching Assistant) chuyên biệt và độc lập dành riêng cho trang Học Lý Thuyết của khóa học "${courseTitle || ''}" trên nền tảng CircuitCraft 3D.

THÔNG TIN KHÓA HỌC & BÀI GIẢNG HIỆN TẠI:
- Tên khóa học: ${courseTitle || ''}
- Mô tả khóa học: ${courseDescription || ''}
- Cấu trúc toàn khóa học: ${courseSyllabusSummary || ''}
- Bài học lý thuyết đang mở: "${lessonTitle || ''}" (${lessonSummary || ''})

SLIDE MÀ HỌC VIÊN ĐANG XEM HIỆN TẠI (RẤT QUAN TRỌNG):
${currentSlideText}

TOÀN BỘ NỘI DUNG CÁC SLIDE TRONG BÀI GIẢNG NÀY (ĐỂ BẠN NẮM HẾT BÀI GIẢNG):
${slideDeckText}

NGUYÊN TẮC TRẢ LỜI CỦA TRỢ GIẢNG AI:
1. Bạn luôn biết chính xác học viên đang dừng ở Slide số mấy và nội dung trên slide đó là gì.
2. Bạn cũng nắm rõ toàn bộ tất cả các slide trong bài giảng cũng như toàn bộ chương trình của khóa học.
3. Khi học viên hỏi (ví dụ: "Giải thích slide này", "Ý nghĩa công thức này là gì?", "Tóm tắt bài học"), hãy giải thích rõ ràng, sư phạm, dễ hiểu, có ví dụ thực tế liên hệ trực tiếp với nội dung của Slide hiện tại và liên kết mạch lạc với các slide khác trong bài.
4. Trình bày câu trả lời bằng tiếng Việt súc tích, thân thiện, khích lệ tinh thần học tập.`;

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-8)) {
        if (!h.content) continue;
        const role = h.role === 'assistant' ? 'model' : 'user';
        if (contents.length === 0 && role === 'model') continue;
        contents.push({
          role,
          parts: [{ text: h.content }],
        });
      }
    }

    const userPromptWithSlideContext = `[Học viên đang xem Slide ${currentSlide?.slideNumber || currentSlideNumber || 1}: "${
      currentSlide?.title || ''
    }"]\nCâu hỏi của học viên: ${prompt}`;

    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += `\n${userPromptWithSlideContext}`;
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: userPromptWithSlideContext }],
      });
    }

    const response = await generateWithGemini(ai, {
      contents,
      config: {
        systemInstruction,
        temperature: 0.5,
      },
    });

    const reply =
      response.text ||
      `Mình đang theo dõi Slide ${currentSlide?.slideNumber || 1} ("${currentSlide?.title || ''}"). Bạn cần mình giải thích chi tiết phần nào trên slide này?`;
    res.json({ success: true, reply });
  } catch (err: any) {
    res.json({
      success: true,
      reply: `**[Trợ giảng AI — Slide ${currentSlide?.slideNumber || 1}: ${currentSlide?.title || ''}]**\nNội dung chính của slide: ${(
        currentSlide?.bullets || []
      ).join('; ')}. Bạn có thể xem tiếp các slide kế tiếp hoặc đặt câu hỏi cụ thể hơn nhé!`,
    });
  }
});

// 5. CircuitCraft 3D - Email OTP Authentication Routes
app.post('/api/auth/check-email', rateLimit('auth-check-email', 30, 60 * 1000), async (req, res) => {
  try {
    const { email, intent } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ email.' });
    }

    // Kiểm tra định dạng & sự tồn tại thực tế của tên miền email trên Internet
    const check = await validateEmailFormatAndExistence(email);
    if (!check.valid || !check.exists) {
      return res.status(400).json({
        success: false,
        validFormat: check.valid,
        existsOnInternet: check.exists,
        registered: false,
        message: check.reason || 'Địa chỉ email không tồn tại hoặc không thể nhận thư.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const registered = await isEmailRegistered(cleanEmail);

    if (intent === 'signup' && registered) {
      return res.status(400).json({
        success: false,
        validFormat: true,
        existsOnInternet: true,
        registered: true,
        message: 'Email này đã được đăng ký tài khoản trên hệ thống. Vui lòng chuyển sang tab Đăng nhập để tiếp tục.',
      });
    }

    if (intent === 'signin' && !registered) {
      return res.status(400).json({
        success: false,
        validFormat: true,
        existsOnInternet: true,
        registered: false,
        message: 'Email này chưa được đăng ký tài khoản. Vui lòng chuyển sang tab Đăng ký để tạo tài khoản mới.',
      });
    }

    res.json({
      success: true,
      validFormat: true,
      existsOnInternet: true,
      registered,
      message: intent === 'signup' ? 'Email hợp lệ và sẵn sàng để đăng ký tài khoản.' : 'Email hợp lệ.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Lỗi kiểm tra email' });
  }
});

app.post(['/api/auth/send-otp', '/api/auth/send-email-otp'], rateLimit('otp-send', 60, 10 * 60 * 1000), async (req, res) => {
  try {
    const { email, fullName, password, intent } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ email.' });
    }

    // 1. Kiểm tra tính hợp lệ & sự tồn tại thực tế của hộp thư/tên miền qua DNS MX
    const emailCheck = await validateEmailFormatAndExistence(email);
    if (!emailCheck.valid || !emailCheck.exists) {
      return res.status(400).json({
        success: false,
        message: emailCheck.reason || 'Địa chỉ email không tồn tại hoặc không đúng định dạng. Vui lòng kiểm tra lại.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const registered = await isEmailRegistered(cleanEmail);

    // 2. Kiểm tra theo chế độ Đăng ký (Sign Up)
    if (intent === 'signup') {
      if (registered) {
        return res.status(400).json({
          success: false,
          message: 'Email này đã được đăng ký tài khoản trên hệ thống. Vui lòng chuyển sang tab Đăng nhập để tiếp tục.',
        });
      }
    }

    // 3. Kiểm tra theo chế độ Đăng nhập (Sign In)
    if (intent === 'signin') {
      if (!registered) {
        return res.status(400).json({
          success: false,
          message: 'Email này chưa được đăng ký tài khoản. Vui lòng chuyển sang tab Đăng ký để tạo tài khoản mới.',
        });
      }

      // Nếu đã đăng ký và có nhập mật khẩu, kiểm tra mật khẩu
      if (password) {
        // Chỉ các lần sai mới bị tính, theo từng tài khoản (chống dò mật khẩu qua nhiều địa chỉ IP)
        const passwordGuessKey = `password-guess:${cleanEmail}`;
        const guessLimit = await peekRateLimit(passwordGuessKey, 10, 15 * 60 * 1000);
        if (guessLimit.limited) return sendRateLimited(res, guessLimit.retryAfterSec);
        const isPasswordCorrect = await verifyUserPassword(cleanEmail, password);
        if (!isPasswordCorrect) {
          await recordRateLimitHit(passwordGuessKey, 10, 15 * 60 * 1000);
          return res.status(400).json({
            success: false,
            message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại.',
          });
        }
      }
    }

    // 4. Nếu kiểm tra hợp lệ, tiến hành sinh và gửi mã OTP qua email
    const targetLimit = await hitRateLimit(`otp-target:${cleanEmail}`, 6, 10 * 60 * 1000);
    if (targetLimit.limited) return sendRateLimited(res, targetLimit.retryAfterSec);
    // A code from this route can only sign in: recovery codes come from the forgot-password route
    const result = await createAndSendOtp({
      email: cleanEmail,
      fullName,
      intent: intent === 'recovery' ? undefined : intent,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    console.error('[CircuitCraft Auth] Error sending OTP:', err);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi gửi mã OTP: ' + (err?.message || err) });
  }
});

app.get('/api/auth/check-delivery-status', rateLimit('otp-delivery', 20, 60 * 1000), async (req, res) => {
  try {
    const email = (req.query.email as string || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email.' });
    }
    const bounce = await checkEmailDeliveryBounce(email, 3200);
    if (bounce.bounced) {
      await revokeOtp(email);
      return res.json({
        success: true,
        bounced: true,
        message: bounce.reason || 'Địa chỉ email này không tồn tại trên thực tế (Google Mail Delivery Subsystem báo lỗi 550: Không tìm thấy địa chỉ).',
      });
    }
    res.json({ success: true, bounced: false });
  } catch (err: any) {
    res.json({ success: true, bounced: false, error: err?.message });
  }
});

app.post('/api/auth/verify-otp', rateLimit('otp-verify', 120, 10 * 60 * 1000), async (req, res) => {
  try {
    const { email, code, intent, password, fullName } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email và mã OTP 6 số.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const verifyLimit = await hitRateLimit(`otp-verify-target:${cleanEmail}`, 30, 10 * 60 * 1000);
    if (verifyLimit.limited) return sendRateLimited(res, verifyLimit.retryAfterSec);
    const result = await verifyOtpCodeAsync({ email: cleanEmail, code, purposes: ['auth'] });
    if (!result.success) {
      return res.status(400).json(result);
    }

    // Nếu là luồng đăng ký mới và có mật khẩu, lưu tài khoản vào cơ sở dữ liệu
    let userRecord = getUserByEmail(cleanEmail);
    if (intent === 'signup' && password) {
      userRecord = await registerNewUser({
        email: cleanEmail,
        password,
        fullName: fullName || result.user?.fullName,
        phone: req.body.phone,
      });
    } else if (!userRecord) {
      userRecord = ensureAuthenticatedUserRecord({
        email: cleanEmail,
        fullName: fullName || result.user?.fullName,
        verified: true,
      });
    } else {
      userRecord = ensureAuthenticatedUserRecord({
        id: userRecord.id,
        email: cleanEmail,
        fullName: userRecord.fullName,
        verified: true,
      });
    }

    if (userRecord.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản này đã bị tạm khóa. Vui lòng liên hệ Quản trị viên.',
      });
    }

    const sessionToken = createSessionToken(userRecord);

    const isAdmin = isVerifiedAdminEmail(userRecord.email, Boolean(userRecord.verifiedAt));

    result.user = {
      id: userRecord.id,
      email: userRecord.email,
      fullName: userRecord.fullName,
      role: isAdmin ? 'admin' : userRecord.role,
      tier: userRecord.tier,
      phone: userRecord.phone,
      isAdmin,
    } as any;

    (result as any).sessionToken = sessionToken;

    addSystemLog({
      level: 'success',
      category: 'auth',
      action: intent === 'signup' ? 'USER_SIGNUP_VERIFIED' : 'USER_LOGIN_VERIFIED',
      actorId: userRecord.id,
      actorEmail: userRecord.email,
      details: `Xác thực OTP thành công cho ${userRecord.email} (Vai trò: ${isAdmin ? 'admin' : userRecord.role})`,
    });

    res.json(result);
  } catch (err: any) {
    console.error('[CircuitCraft Auth] Error verifying OTP:', err);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xác thực mã OTP.' });
  }
});

// ==================== PHONE OTP AUTHENTICATION (REMOVED) ====================
// Hệ thống đã chuyển đổi 100% sang gửi mã OTP qua Email
app.post(['/api/auth/check-phone', '/api/auth/send-phone-otp', '/api/auth/verify-phone-otp'], (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'Hệ thống đã chuyển đổi hoàn toàn sang xác thực mã OTP qua Email. Vui lòng sử dụng Email để đăng nhập hoặc đăng ký.',
  });
});

// Cập nhật vai trò người dùng.
// - Người dùng chỉ được đổi vai trò của CHÍNH MÌNH, và chỉ lên 'pro'/'creator' khi máy chủ đã ghi nhận
//   quyền tương ứng (gói đã thanh toán / quản trị viên cấp). Hạ về 'user' luôn được phép.
// - Quản trị viên được đổi vai trò người khác (trừ cấp 'admin', vốn chỉ gắn với ADMIN_EMAIL).
app.post('/api/user/role', requireAuth, async (req, res) => {
  try {
    const authUser = getAuthUser(req)!;
    const { emailOrId, role } = req.body;
    if (!role || !['user', 'pro', 'creator', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ.' });
    }
    const targetKey = emailOrId || authUser.id;
    const existing = getUserById(targetKey) || getUserByEmail(targetKey);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản để cập nhật quyền.' });
    }
    const actingAsAdmin = isAdminUser(authUser);
    if (existing.id !== authUser.id && !actingAsAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: Bạn chỉ được thay đổi vai trò của chính mình.' });
    }
    if (role === 'admin' && !isVerifiedAdminEmail(existing.email, Boolean(existing.verifiedAt))) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Không được phép tự nâng quyền Quản trị viên (Admin).',
      });
    }
    if (!actingAsAdmin) {
      const hasCreator =
        (tierIsReal(existing) && existing.tier === 'creator') || hasEntitlement(existing.id, 'plan-creator');
      const hasStudent =
        hasCreator || (tierIsReal(existing) && existing.tier === 'student') || hasEntitlement(existing.id, 'plan-student');
      if ((role === 'creator' && !hasCreator) || (role === 'pro' && !hasStudent)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Cần mua gói tương ứng (hoặc được Quản trị viên cấp) trước khi chuyển vai trò.',
          role: existing.role,
          tier: existing.tier,
        });
      }
    }
    const success = updateUserRole(existing.id, role);
    const updated = getUserById(existing.id) || existing;
    res.json({
      success,
      message: `Đã cập nhật vai trò thành công: ${updated.role}`,
      role: updated.role,
      tier: updated.tier,
      isAdmin: isVerifiedAdminEmail(updated.email, Boolean(updated.verifiedAt)),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function publicSessionUser(userRecord: any) {
  const isAdmin = isVerifiedAdminEmail(userRecord.email, Boolean(userRecord.verifiedAt));
  return {
    id: userRecord.id,
    email: userRecord.email,
    fullName: userRecord.fullName,
    role: isAdmin ? 'admin' : userRecord.role,
    tier: userRecord.tier,
    phone: userRecord.phone,
    status: userRecord.status || 'active',
    isAdmin,
    verifiedAt: userRecord.verifiedAt,
  };
}

// Đồng bộ phiên đăng nhập: CHỈ chấp nhận danh tính đã được xác minh qua Bearer token
// (token phiên CircuitCraft hợp lệ, hoặc access token Supabase được Supabase Auth xác nhận).
// Email / isVerified / role gửi trong body đều bị bỏ qua.
app.post('/api/auth/session', (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({
      success: false,
      error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      code: 'UNAUTHORIZED',
    });
  }
  if (req.body?.fullName && typeof req.body.fullName === 'string' && !authUser.fullName) {
    authUser.fullName = req.body.fullName.trim().slice(0, 120);
  }
  // Làm mới token nhưng giữ nguyên mã phiên của thiết bị. Khi đăng nhập bằng token Supabase, thiết bị
  // gửi kèm token phiên hiện có (đã kiểm tra chữ ký và đúng chủ) để không sinh thêm phiên mới.
  let sid = getAuthSession(req)?.sid;
  if (!sid && typeof req.body?.previousSessionToken === 'string') {
    const previous = verifySessionToken(req.body.previousSessionToken);
    if (previous && previous.user.id === authUser.id) sid = previous.sid;
  }
  res.json({
    success: true,
    sessionToken: createSessionToken(authUser, sid),
    user: publicSessionUser(authUser),
  });
});

// Đăng xuất thiết bị hiện tại: chỉ thu hồi phiên của token đang dùng
app.post('/api/auth/logout', (req, res) => {
  const authUser = getAuthUser(req);
  const session = getAuthSession(req);
  if (authUser && session) {
    revokeSession(session);
    addSystemLog({
      level: 'info',
      category: 'auth',
      action: 'USER_LOGOUT',
      actorId: authUser.id,
      actorEmail: authUser.email,
      details: `Đăng xuất một thiết bị của ${authUser.email}`,
    });
  }
  res.json({ success: true });
});

// Đăng xuất mọi thiết bị (ví dụ khi nghi ngờ bị lộ tài khoản). Đặt lại mật khẩu cũng có tác dụng này.
app.post('/api/auth/logout-all', requireAuth, (req, res) => {
  const authUser = getAuthUser(req)!;
  bumpSessionVersion(authUser.id);
  addSystemLog({
    level: 'warning',
    category: 'auth',
    action: 'USER_LOGOUT_ALL',
    actorId: authUser.id,
    actorEmail: authUser.email,
    details: `Thu hồi toàn bộ phiên đăng nhập của ${authUser.email}`,
  });
  res.json({ success: true });
});

// 5.1 Quên mật khẩu - Gửi mã xác thực OTP 6 số về Email
app.post('/api/auth/forgot-password/send-email-otp', rateLimit('otp-recovery-send', 20, 10 * 60 * 1000), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp địa chỉ email tài khoản để nhận mã xác thực OTP.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Kiểm tra định dạng email và tên miền
    const emailCheck = await validateEmailFormatAndExistence(cleanEmail);
    if (!emailCheck.valid || !emailCheck.exists) {
      return res.status(400).json({
        success: false,
        message: emailCheck.reason || 'Địa chỉ email không tồn tại hoặc không đúng định dạng. Vui lòng kiểm tra lại.',
      });
    }

    // 2. Kiểm tra tài khoản có tồn tại trên hệ thống hay không
    let user = getUserByEmail(cleanEmail);
    if (!user) {
      await isEmailRegistered(cleanEmail);
      user = getUserByEmail(cleanEmail);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy tài khoản nào khớp với email "${cleanEmail}" trên hệ thống. Vui lòng kiểm tra lại hoặc tạo tài khoản mới.`,
      });
    }

    // 3. Tiến hành sinh và gửi mã OTP 6 số tới email với mẫu khôi phục mật khẩu
    const targetLimit = await hitRateLimit(`otp-target:${cleanEmail}`, 6, 10 * 60 * 1000);
    if (targetLimit.limited) return sendRateLimited(res, targetLimit.retryAfterSec);
    const result = await createAndSendOtp({
      email: cleanEmail,
      fullName: user.fullName,
      intent: 'recovery',
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Đã gửi mã OTP vào email của bạn',
      email: cleanEmail,
      fullName: user.fullName,
      cooldownSeconds: result.cooldownSeconds || 60,
      previewHtml: result.previewHtml,
      simulated: false,
    });
  } catch (err: any) {
    console.error('[CircuitCraft Auth] Error sending forgot-password email OTP:', err);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi gửi mã OTP qua email: ' + (err?.message || err) });
  }
});

// Alias for generic forgot-password send-otp
app.post('/api/auth/forgot-password/send-otp', async (req, res, next) => {
  req.url = '/api/auth/forgot-password/send-email-otp';
  app._router.handle(req, res, next);
});

// 5.2 Quên mật khẩu - Xác thực mã OTP 6 số qua Email và Đặt lại mật khẩu mới
app.post('/api/auth/forgot-password/reset-password', rateLimit('otp-recovery-reset', 60, 10 * 60 * 1000), async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword, phone } = req.body;
    
    // Hỗ trợ định danh email chính thức
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    if (!cleanEmail || !cleanCode) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp địa chỉ email và mã xác thực OTP 6 số.',
      });
    }

    if (cleanCode.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Mã xác thực OTP phải gồm đúng 6 chữ số.',
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu xác nhận không trùng khớp với mật khẩu mới.',
      });
    }

    // 1. Xác thực mã OTP 6 số đã gửi tới Email
    const verifyLimit = await hitRateLimit(`otp-verify-target:${cleanEmail}`, 30, 10 * 60 * 1000);
    if (verifyLimit.limited) return sendRateLimited(res, verifyLimit.retryAfterSec);
    const verifyResult = await verifyOtpCodeAsync({ email: cleanEmail, code: cleanCode, purposes: ['recovery'] });
    if (!verifyResult.success) {
      // Nếu không khớp qua email, kiểm tra fallback nếu có phone
      const accountForEmail = getUserByEmail(cleanEmail);
      const phoneOwnedByAccount =
        Boolean(phone) &&
        Boolean(accountForEmail?.phone) &&
        normalizePhoneNumber(String(phone)) === normalizePhoneNumber(String(accountForEmail!.phone));
      if (phoneOwnedByAccount) {
        const phoneVerify = await verifyPhoneOtpCode({ phone: normalizePhoneNumber(String(phone)), code: cleanCode });
        if (!phoneVerify.success) {
          return res.status(400).json(verifyResult);
        }
      } else {
        return res.status(400).json(verifyResult);
      }
    }

    // 2. Cập nhật mật khẩu mới cho tài khoản người dùng
    const updateResult = await updateUserPassword(cleanEmail, newPassword);

    if (!updateResult.success || !updateResult.user) {
      return res.status(404).json({
        success: false,
        message: updateResult.message || `Không thể tìm thấy tài khoản "${cleanEmail}" để cập nhật mật khẩu mới.`,
      });
    }

    res.json({
      success: true,
      message: 'Khôi phục và đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bây giờ bằng mật khẩu mới.',
      user: {
        id: updateResult.user.id,
        email: updateResult.user.email,
        fullName: updateResult.user.fullName,
        role: updateResult.user.role,
      },
    });
  } catch (err: any) {
    console.error('[CircuitCraft Auth] Error resetting password via email OTP:', err);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đặt lại mật khẩu: ' + (err?.message || err) });
  }
});

// 5.2.b Quên mật khẩu - Gửi mã xác thực OTP 6 số về Số điện thoại
app.post('/api/auth/forgot-password/send-phone-otp', rateLimit('otp-phone-send', 20, 10 * 60 * 1000), async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp số điện thoại.' });
    }

    const phoneValidation = validatePhoneNumber(phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ success: false, message: phoneValidation.reason || 'Số điện thoại không đúng định dạng.' });
    }

    const cleanPhone = normalizePhoneNumber(phone);
    const user = getUserByPhone(cleanPhone);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy tài khoản nào liên kết với số điện thoại "${phone}".`,
      });
    }

    const targetLimit = await hitRateLimit(`otp-target:${cleanPhone}`, 6, 10 * 60 * 1000);
    if (targetLimit.limited) return sendRateLimited(res, targetLimit.retryAfterSec);
    const result = await createAndSendPhoneOtp({
      phone: cleanPhone,
      email: user.email,
      intent: 'recovery',
      fullName: user.fullName,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      ...result,
      phone: cleanPhone,
      fullName: user.fullName,
    });
  } catch (err: any) {
    console.error('[CircuitCraft Auth] Error sending forgot-password phone OTP:', err);
    res.status(500).json({ success: false, message: 'Lỗi gửi mã OTP khôi phục qua SMS: ' + (err?.message || err) });
  }
});

// 5.2.c Quên mật khẩu - Đặt lại mật khẩu bằng mã OTP điện thoại
app.post('/api/auth/forgot-password/reset-phone-password', rateLimit('otp-phone-reset', 60, 10 * 60 * 1000), async (req, res) => {
  try {
    const { phone, code, newPassword, confirmPassword } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp số điện thoại và mã OTP 6 số.' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu xác nhận không trùng khớp.' });
    }

    const cleanPhone = normalizePhoneNumber(phone);
    const verifyLimit = await hitRateLimit(`otp-verify-target:${cleanPhone}`, 30, 10 * 60 * 1000);
    if (verifyLimit.limited) return sendRateLimited(res, verifyLimit.retryAfterSec);
    const verifyRes = await verifyPhoneOtpCode({ phone: cleanPhone, code: code.trim() });
    if (!verifyRes.success) {
      return res.status(400).json(verifyRes);
    }

    const updateResult = await updateUserPassword(cleanPhone, newPassword);
    if (!updateResult.success || !updateResult.user) {
      return res.status(404).json({
        success: false,
        message: updateResult.message || 'Không tìm thấy tài khoản để đặt lại mật khẩu.',
      });
    }

    res.json({
      success: true,
      message: 'Khôi phục và đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.',
      user: {
        id: updateResult.user.id,
        email: updateResult.user.email,
        fullName: updateResult.user.fullName,
        role: updateResult.user.role,
        phone: updateResult.user.phone,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi đặt lại mật khẩu qua SMS: ' + (err?.message || err) });
  }
});

// 5.3 Xem nội dung tin nhắn SMS gần nhất gửi tới số điện thoại (cho mục đích kiểm thử / thông báo)
app.get('/api/auth/sms-preview/:phone', (req, res) => {
  if (!isDevPreviewEnabled()) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  const phone = req.params.phone;
  const dispatched = getDispatchedSms(phone);
  if (!dispatched) {
    return res.status(404).json({ error: 'Chưa có tin nhắn SMS nào gửi tới số điện thoại này.' });
  }
  res.json({ success: true, sms: dispatched });
});

app.get('/api/auth/email-preview/:email', (req, res) => {
  if (!isDevPreviewEnabled()) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  const email = req.params.email;
  const dispatched = getDispatchedEmail(email);
  if (!dispatched) {
    return res.status(404).json({ error: 'Chưa có email nào gửi đến địa chỉ này.' });
  }
  res.json({ success: true, email: dispatched });
});

app.get('/api/cloud-status', (req, res) => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasAnonKey = Boolean(process.env.VITE_SUPABASE_ANON_KEY);
  res.json({
    status: url ? 'configured' : 'unconfigured',
    supabaseUrl: url ? url.replace(/^(https?:\/\/[^/]+).*/, '$1') : null,
    hasServiceRole,
    hasAnonKey,
  });
});

app.get('/api/config/supabase', (req, res) => {
  res.json({
    url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
  });
});

/**
 * Personal projects: identity comes ONLY from the verified Bearer token. `userId` / `userEmail`
 * in the query, body or X-User-* headers are ignored for authorisation. Legacy records are
 * matched by owner id OR by the owner's (verified) e-mail so existing projects stay reachable.
 */
function isProjectOwner(user: { id: string; email: string } | null, project: any): boolean {
  if (!user || !project) return false;
  if (project.ownerId === user.id || project.document?.authorId === user.id) return true;
  return Boolean(project.ownerEmail) && project.ownerEmail.toLowerCase() === user.email.toLowerCase();
}

app.get('/api/projects', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    // Guests keep their projects in browser storage; never leak server-side records
    return res.json({ projects: [] });
  }
  const all = listAllPersonalProjects();

  // Admin requesting all projects explicitly (via ?all=true)
  if (isAdminUser(user) && req.query.all === 'true') {
    return res.json({ projects: all });
  }

  const seenIds = new Set<string>();
  const uniqueList = [];
  for (const item of all) {
    if (!isProjectOwner(user, item)) continue;
    const pId = item.id || item.document?.projectId;
    if (pId && !seenIds.has(pId)) {
      seenIds.add(pId);
      uniqueList.push(item);
    }
  }
  res.json({ projects: uniqueList });
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  const user = getAuthUser(req)!;
  const project = listAllPersonalProjects().find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!isAdminUser(user) && !isProjectOwner(user, project)) {
    return res.status(403).json({ error: 'Access denied to this project' });
  }
  res.json({ project });
});

/** Saves a project for the authenticated user; refuses to overwrite someone else's project id. */
type SaveOwnedProjectResult =
  | { error: string; status: 400 | 403 | 409; remoteRevision?: number }
  | { saved: ReturnType<typeof syncPersonalProject> };

function saveOwnedProject(req: express.Request, project: any, versionNote?: string, force = false): SaveOwnedProjectResult {
  const user = getAuthUser(req)!;
  const doc = project?.projectId ? project : project?.id ? { ...project, projectId: project.id } : null;
  if (!doc) return { error: 'Invalid project payload', status: 400 };
  const existing = listAllPersonalProjects().find((p) => p.id === doc.projectId);
  if (existing && !isProjectOwner(user, existing) && !isAdminUser(user)) {
    return { error: 'Mã dự án này thuộc về tài khoản khác. Không thể ghi đè.', status: 403 };
  }
  // A save based on an older revision would discard what was saved since (another device, another tab)
  if (existing && !force && Number(doc.revision) < Number(existing.revision)) {
    return { error: 'Dự án đã có phiên bản mới hơn trên máy chủ.', status: 409, remoteRevision: Number(existing.revision) };
  }
  const owner = existing && isAdminUser(user) && !isProjectOwner(user, existing)
    ? { userId: existing.ownerId, userEmail: existing.ownerEmail, userName: existing.ownerName }
    : { userId: user.id, userEmail: user.email, userName: user.fullName };
  const saved = syncPersonalProject({ project: { ...doc, authorId: owner.userId }, ...owner, versionNote });
  return { saved };
}

app.post('/api/projects', requireAuth, (req, res) => {
  const result = saveOwnedProject(req, req.body?.project, req.body?.versionNote);
  if ('error' in result) return res.status(result.status).json({ error: result.error });
  res.json({ success: true, id: result.saved?.id, project: result.saved });
});

app.post('/api/projects/sync', requireAuth, (req, res) => {
  const { project, projects, versionNote } = req.body;
  if (Array.isArray(projects)) {
    let count = 0;
    let rejected = 0;
    for (const p of projects) {
      const result = saveOwnedProject(req, p);
      if ('error' in result) rejected += 1;
      else if (result.saved) count += 1;
    }
    return res.json({ success: true, count, rejected });
  }
  if (project) {
    const result = saveOwnedProject(req, project, versionNote, req.body.force === true);
    if ('error' in result) {
      return res.status(result.status).json({
        error: result.error,
        ...(result.status === 409 ? { code: 'PROJECT_CONFLICT', remoteRevision: result.remoteRevision } : {}),
      });
    }
    const saved = result.saved;
    if (saved) {
      addSystemLog({
        level: 'info',
        category: 'project',
        action: 'PROJECT_SAVED',
        actorId: saved.ownerId,
        actorEmail: saved.ownerEmail,
        targetId: saved.id,
        details: `Lưu dự án "${saved.name}" (Revision #${saved.revision}, ${saved.componentCount} linh kiện)`,
      });
    }
    return res.json({ success: true, project: saved });
  }
  res.status(400).json({ error: 'Missing project data' });
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const user = getAuthUser(req)!;
  const project = listAllPersonalProjects().find((p) => p.id === req.params.id);
  if (!project) return res.json({ success: true });
  if (!isAdminUser(user) && !isProjectOwner(user, project)) {
    return res.status(403).json({ success: false, error: 'Bạn không thể xóa dự án của người khác.' });
  }
  removePersonalProject(project.id);
  res.json({ success: true });
});

// Course enrollment & progress: always recorded for the authenticated user
const handleCourseProgress = (req: express.Request, res: express.Response) => {
  const user = getAuthUser(req)!;
  const { courseId, courseTitle, completedLessons, totalLessons } = req.body;
  if (!courseId) {
    return res.status(400).json({ error: 'Missing courseId' });
  }
  if (!canAccessCourseContent(req, String(courseId))) {
    return res.status(403).json({ success: false, error: 'Bạn cần mua khóa học trước khi ghi danh.', code: 'PAYMENT_REQUIRED' });
  }
  const enrollment = recordCourseEnrollment({
    userId: user.id,
    userEmail: user.email,
    courseId,
    courseTitle: courseTitle || creatorStore.getCourse(courseId)?.title || SERVER_PRODUCTS[courseId]?.title || courseId,
    completedLessons: Array.isArray(completedLessons) ? completedLessons.map(String) : undefined,
    totalLessons: Number(totalLessons) > 0 ? Number(totalLessons) : undefined,
  });
  addSystemLog({
    level: 'info',
    category: 'course',
    action: 'COURSE_PROGRESS_SYNC',
    actorId: user.id,
    actorEmail: enrollment.userEmail,
    targetId: courseId,
    details: `Cập nhật tiến độ khóa học "${enrollment.courseTitle}" (${enrollment.progressPercent}%)`,
  });
  res.json({ success: true, enrollment });
};
app.post('/api/courses/enroll', requireAuth, handleCourseProgress);
app.post('/api/courses/progress', requireAuth, handleCourseProgress);

// ==========================================
// 6. CREATOR ECONOMY & MARKETPLACE API ROUTES
// ==========================================

// 6.1 Creator Profile
// Public read of a creator's display profile (no private data is stored in profiles)
app.get('/api/creator/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const profile = creatorStore.getProfile(userId) || {
    userId,
    displayName: getUserById(userId)?.fullName || 'Nhà sáng tạo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, profile });
});

app.get('/api/creator/profile', requireAuth, (req, res) => {
  const authUser = getAuthUser(req)!;
  const requested = (req.query.userId as string) || authUser.id;
  const uid = isSelfOrAdmin(authUser, requested) ? (isAdminUser(authUser) ? requested : authUser.id) : authUser.id;
  const profile = creatorStore.getProfile(uid) || {
    userId: uid,
    displayName: getUserById(uid)?.fullName || authUser.fullName || 'Nhà sáng tạo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, profile });
});

const handleCreatorProfileUpdate = (req: express.Request, res: express.Response) => {
  const uid = resolveActingCreator(req, res);
  if (!uid) return;
  const { displayName, bio, specialty, avatarUrl, socialLinks } = req.body;
  // `tier` and `isVerified` are never accepted from the client
  const profile = creatorStore.upsertProfile(uid, { displayName, bio, specialty, avatarUrl, socialLinks });
  res.json({ success: true, profile });
};
app.post('/api/creator/profile', handleCreatorProfileUpdate);
app.put('/api/creator/profile', handleCreatorProfileUpdate);

// Activating the Creator tier only reflects a server-side entitlement (plan purchase / admin grant)
app.post('/api/creator/activate-tier', requireAuth, (req, res) => {
  const authUser = getAuthUser(req)!;
  if (!isCreatorUser(authUser.id)) {
    return res.status(403).json({
      success: false,
      error: 'Cần mua gói Creator (hoặc được Quản trị viên cấp quyền) trước khi kích hoạt Không gian Nhà sáng tạo.',
      code: 'CREATOR_REQUIRED',
    });
  }
  creatorStore.upsertProfile(authUser.id, { tier: 'creator' });
  res.json({ success: true, tier: 'creator' });
});

// Creator Overview & Analytics
app.get('/api/creator/overview/:userId', requireAuth, (req, res) => {
  const authUser = getAuthUser(req)!;
  const { userId } = req.params;
  if (!isSelfOrAdmin(authUser, userId)) {
    return res.status(403).json({ error: 'Bạn chỉ được xem số liệu của chính mình.', code: 'FORBIDDEN' });
  }
  const uid = isAdminUser(authUser) ? userId : authUser.id;
  if (!isCreatorUser(uid)) {
    return res.status(403).json({
      error: 'Quyền truy cập bị từ chối: Cần gói Nhà sáng tạo (Creator Plan) để xem dữ liệu này.',
    });
  }
  const profile = creatorStore.getProfile(uid) || {
    userId: uid,
    displayName: getUserById(uid)?.fullName || 'Nhà sáng tạo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, profile, analytics: creatorStore.getCreatorAnalytics(uid) });
});

// 6.2 Creator Products (own products only; admins may query any creator)
const handleListCreatorProducts = (req: express.Request, res: express.Response, requested?: string) => {
  const authUser = getAuthUser(req)!;
  const uid = isAdminUser(authUser) && requested ? requested : authUser.id;
  if (requested && !isSelfOrAdmin(authUser, requested)) {
    return res.status(403).json({ success: false, error: 'Bạn chỉ được xem sản phẩm của chính mình.', code: 'FORBIDDEN' });
  }
  res.json({ success: true, products: creatorStore.listCreatorProducts(uid) });
};
app.get('/api/creator/products', requireAuth, (req, res) => handleListCreatorProducts(req, res, req.query.userId as string));
app.get('/api/creator/products/:userId', requireAuth, (req, res) => handleListCreatorProducts(req, res, req.params.userId));

// Create Marketplace Product from a project (accepts both payload shapes used by the clients)
app.post('/api/creator/products', (req, res) => {
  const uid = resolveActingCreator(req, res);
  if (!uid) return;
  try {
    const {
      sourceProjectId,
      title,
      tagline,
      description,
      price,
      currency,
      difficulty,
      category,
      tags,
      componentsSummary,
      prerequisites,
      deliverables,
      simulationCapability,
      language,
      license,
      releaseNotes,
    } = req.body;
    const projectDocument = req.body.projectDocument || req.body.projectSnapshot;
    const versionNumber = req.body.versionNumber || req.body.version || '1.0.0';

    const val = creatorStore.validateProject(projectDocument);
    if (!val.valid) {
      return res.status(400).json({
        success: false,
        error: `Dự án chưa đạt tiêu chuẩn kỹ thuật: ${val.errors.join('; ')}`,
        errors: val.errors,
      });
    }

    const profile = creatorStore.getProfile(uid);
    const creatorName = profile?.displayName || getUserById(uid)?.fullName || 'Nhà sáng tạo';
    const productId = `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const summary = Array.isArray(componentsSummary)
      ? componentsSummary
      : projectDocument.components.map((c: any) => c.name || c.definitionId).slice(0, 5);

    const product = creatorStore.createProduct({
      id: productId,
      creatorId: uid,
      creatorName,
      type: 'project',
      title: title || projectDocument.name || 'Mạch điện thiết kế 3D',
      tagline: tagline || 'Mô hình mạch điện tương tác',
      description: description || 'Mạch điện nguyên lý và mô phỏng 3D trên nền tảng CircuitCraft',
      price: Math.max(0, Math.floor(Number(price) || 0)),
      currency: currency === 'VND' || !currency ? 'VND' : 'VND',
      status: 'PUBLISHED', // Auto-publish once validated
      difficulty: difficulty || 'Trung bình',
      category: category || 'Mạch ứng dụng',
      tags: Array.isArray(tags) ? tags : ['3D', 'Mô phỏng'],
      componentsSummary: summary,
      deliverables: Array.isArray(deliverables) ? deliverables : ['Mô hình 3D', 'Sơ đồ nguyên lý'],
      prerequisites: Array.isArray(prerequisites) ? prerequisites : [],
      simulationCapability: simulationCapability || 'Mô phỏng dòng DC & Logic',
      language: language || 'vi',
      license: license || 'Giấy phép sử dụng cá nhân & thương mại cơ bản',
      currentVersionNumber: versionNumber,
    });

    const versionObj = creatorStore.createProductVersion({
      productId,
      creatorId: uid,
      version: versionNumber,
      sourceProjectId: sourceProjectId || projectDocument.projectId || productId,
      projectSnapshot: projectDocument,
      changelog: releaseNotes || `Bản phát hành đầu tiên v${versionNumber}`,
    });

    res.json({ success: true, product, version: versionObj });
  } catch (err: any) {
    console.error('Error creating product:', err);
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tạo sản phẩm' });
  }
});

// Update product metadata and/or status (owner or admin)
app.put('/api/creator/products/:id', requireAuth, (req, res) => {
  try {
    const productId = req.params.id;
    let product = creatorStore.getProduct(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
    }
    if (!canManageCreatorResource(req, product.creatorId)) {
      return res.status(403).json({ success: false, error: 'Từ chối quyền: Không sở hữu sản phẩm này', code: 'FORBIDDEN' });
    }
    const { userId: _u, creatorId: _c, status, ...updates } = req.body;
    if (status) {
      product = creatorStore.setProductStatus(productId, product.creatorId, status);
    }
    if (Object.keys(updates).length > 0) {
      product = creatorStore.updateProduct(productId, product.creatorId, updates);
    }
    res.json({ success: true, product });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const handleProductStatusChange = (req: express.Request, res: express.Response, status: ProductStatus) => {
  const product = creatorStore.getProduct(req.params.id);
  if (!product) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
  if (!canManageCreatorResource(req, product.creatorId)) {
    return res.status(403).json({ success: false, error: 'Từ chối quyền', code: 'FORBIDDEN' });
  }
  try {
    res.json({ success: true, product: creatorStore.setProductStatus(product.id, product.creatorId, status) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
};
app.post('/api/creator/products/:id/publish', requireAuth, (req, res) => handleProductStatusChange(req, res, 'PUBLISHED'));
app.post('/api/creator/products/:id/unpublish', requireAuth, (req, res) => handleProductStatusChange(req, res, 'UNPUBLISHED'));

app.delete('/api/creator/products/:id', requireAuth, (req, res) => {
  const product = creatorStore.getProduct(req.params.id);
  if (!product) return res.json({ success: false });
  if (!canManageCreatorResource(req, product.creatorId)) {
    return res.status(403).json({ success: false, error: 'Từ chối quyền: Không sở hữu sản phẩm này', code: 'FORBIDDEN' });
  }
  // Buyer entitlements are kept even when the listing is removed
  res.json({ success: creatorStore.deleteProduct(product.id) });
});

// 6.3 Product Versions
// Owners, admins and buyers (entitlement) receive the full design; everyone else only metadata.
app.get('/api/creator/products/:id/versions', (req, res) => {
  const productId = req.params.id;
  const fullAccess = canAccessFullProduct(req, productId);
  const versions = creatorStore.listVersions(productId).map((v) =>
    fullAccess
      ? v
      : { ...v, projectSnapshot: undefined, previewSnapshot: publicPreviewOnly(v.previewSnapshot), restricted: true }
  );
  res.json({ success: true, versions, fullAccess });
});

app.post('/api/creator/products/:id/versions', requireAuth, (req, res) => {
  try {
    const productId = req.params.id;
    const product = creatorStore.getProduct(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
    }
    if (!canManageCreatorResource(req, product.creatorId)) {
      return res.status(403).json({ success: false, error: 'Không có quyền tạo phiên bản cho sản phẩm này', code: 'FORBIDDEN' });
    }
    const projectDocument = req.body.projectDocument || req.body.projectSnapshot;
    const val = creatorStore.validateProject(projectDocument);
    if (!val.valid) {
      return res.status(400).json({ success: false, error: `Dự án không hợp lệ: ${val.errors.join('; ')}` });
    }
    const version = creatorStore.createProductVersion({
      productId,
      creatorId: product.creatorId,
      version: req.body.versionNumber || req.body.version || '1.1.0',
      sourceProjectId: req.body.sourceProjectId || projectDocument?.projectId || productId,
      projectSnapshot: projectDocument,
      changelog: req.body.releaseNotes || req.body.changelog,
    });
    res.json({ success: true, version });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 6.3b Slide images: stored as files so course documents do not carry base64
app.post('/api/creator/media', rateLimit('creator-media', 600, 10 * 60 * 1000), async (req, res) => {
  const uid = resolveActingCreator(req, res);
  if (!uid) return;
  try {
    const url = await saveCourseImage(req.body?.dataUrl);
    res.json({ success: true, url, previewUrl: signMediaPath(url) });
  } catch (err: any) {
    if (err instanceof CourseMediaError) {
      return res.status(err.status).json({ success: false, error: err.message, code: 'INVALID_MEDIA' });
    }
    console.error('Error saving course media:', err?.message || err);
    res.status(500).json({ success: false, error: 'Không thể lưu ảnh slide.', code: 'MEDIA_SAVE_FAILED' });
  }
});

// Lesson videos: the browser uploads directly to Storage with a one-time link from here
app.post('/api/creator/media/video-upload-url', rateLimit('creator-video', 30, 10 * 60 * 1000), async (req, res) => {
  const uid = resolveActingCreator(req, res);
  if (!uid) return;
  if (!isRemotePersistence()) {
    return res.status(501).json({ success: false, error: 'Tải video trực tiếp cần Supabase Storage. Hãy dùng liên kết YouTube.', code: 'VIDEO_STORAGE_UNAVAILABLE' });
  }
  try {
    res.json({ success: true, ...(await createVideoUploadLink(req.body?.contentType, req.body?.size)) });
  } catch (err: any) {
    if (err instanceof CourseMediaError) {
      return res.status(err.status).json({ success: false, error: err.message, code: 'INVALID_MEDIA' });
    }
    console.error('Error creating video upload link:', err?.message || err);
    res.status(500).json({ success: false, error: 'Không thể chuẩn bị tải video lên.', code: 'MEDIA_SAVE_FAILED' });
  }
});

app.get('/api/media/video/:file', async (req, res) => {
  const { file } = req.params;
  if (!isValidVideoFileName(file)) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy video', code: 'NOT_FOUND' });
  }
  if (!verifyMediaSignature(file, req.query.exp, req.query.sig)) {
    return res.status(403).json({ success: false, error: 'Liên kết video không hợp lệ hoặc đã hết hạn.', code: 'MEDIA_LINK_INVALID' });
  }
  const link = await resolveCourseVideoLink(file);
  if (!link) return res.status(404).json({ success: false, error: 'Không tìm thấy video', code: 'NOT_FOUND' });
  res.setHeader('Cache-Control', 'private, max-age=1800');
  res.redirect(302, link);
});

// Images may belong to paid courses: links are signed when an entitled user receives the content
app.get('/api/media/course/:file', async (req, res) => {
  const { file } = req.params;
  if (!isValidMediaFileName(file)) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy ảnh', code: 'NOT_FOUND' });
  }
  if (!verifyMediaSignature(file, req.query.exp, req.query.sig)) {
    return res.status(403).json({ success: false, error: 'Liên kết ảnh không hợp lệ hoặc đã hết hạn.', code: 'MEDIA_LINK_INVALID' });
  }
  const media = await resolveCourseMedia(file);
  if (!media) return res.status(404).json({ success: false, error: 'Không tìm thấy ảnh', code: 'NOT_FOUND' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (media.kind === 'redirect') {
    res.setHeader('Cache-Control', 'private, max-age=240');
    return res.redirect(302, media.url);
  }
  res.setHeader('Content-Type', media.mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  // Opened directly, an SVG must not run scripts on this origin
  if (media.isSvg) res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.sendFile(media.filePath);
});

// 6.4 Creator Courses
const handleListCreatorCourses = (req: express.Request, res: express.Response, requested?: string) => {
  const authUser = getAuthUser(req);
  const target = requested || authUser?.id;
  if (!target) return res.json({ success: true, courses: [] });
  const all = creatorStore.listCreatorCourses(target);
  // The owner and admins get their full courses; everyone else only the outline of published ones
  const courses = isSelfOrAdmin(authUser, target)
    ? all.map(courseWithSignedMedia)
    : all.filter((c) => c.status === 'PUBLISHED').map(courseSummary);
  res.json({ success: true, courses });
};
app.get('/api/creator/courses', (req, res) => handleListCreatorCourses(req, res, req.query.userId as string));
app.get('/api/creator/courses/:userId', (req, res) => handleListCreatorCourses(req, res, req.params.userId));

app.post('/api/creator/courses', async (req, res) => {
  const uid = resolveActingCreator(req, res);
  if (!uid) return;
  try {
    const {
      title,
      tagline,
      description,
      price,
      currency,
      difficulty,
      level,
      duration,
      category,
      tags,
      prerequisites,
      learningOutcomes,
      syllabus,
      chapters,
    } = req.body;

    const profile = creatorStore.getProfile(uid);
    const creatorName = profile?.displayName || getUserById(uid)?.fullName || 'Nhà sáng tạo';

    const courseId = `course-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const courseChapters = Array.isArray(chapters) && chapters.length > 0
      ? chapters
      : Array.isArray(syllabus)
      ? [
          {
            id: `chap-${Date.now()}`,
            courseId,
            title: 'Nội dung khóa học',
            position: 1,
            lessons: syllabus.map((s: any, idx: number) => ({
              id: s.id || `les-${idx + 1}`,
              chapterId: `chap-${Date.now()}`,
              title: s.title || `Bài học ${idx + 1}`,
              content: s.summary || s.description || s.content || '',
              position: idx + 1,
              videoUrl: s.videoUrl,
              practiceProjectSnapshot: s.practiceProjectSnapshot,
            })),
          },
        ]
      : [];

    const course = creatorStore.createCourse({
      id: courseId,
      creatorId: uid,
      creatorName,
      title: title || 'Khóa học thiết kế mạch 3D',
      tagline: tagline || 'Học lý thuyết & thực hành mô phỏng kỹ thuật điện tử 3D',
      description: description || 'Nội dung đào tạo kết hợp slide lý thuyết và mô phỏng vi mạch.',
      price: Math.max(0, Math.floor(Number(price) || 0)),
      currency: currency || 'VND',
      difficulty: (difficulty || level || 'Cơ bản') as any,
      language: 'vi',
      category: category || 'Điện tử ứng dụng',
      tags: Array.isArray(tags) ? tags : ['Circuit', '3D'],
      prerequisites: Array.isArray(prerequisites) ? prerequisites : [],
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes : [],
      estimatedHours: 10,
      duration: duration || `${Array.isArray(syllabus) ? syllabus.length : 1} bài học`,
      status: 'PUBLISHED',
      chapters: await externalizeSlideImages(courseChapters),
      syllabus: await externalizeSlideImages(Array.isArray(syllabus) ? syllabus : []),
    });

    res.json({ success: true, course });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/creator/courses/:id', requireAuth, async (req, res) => {
  try {
    const courseId = req.params.id;
    let course = creatorStore.getCourse(courseId);
    if (!course) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy khóa học' });
    }
    if (!canManageCreatorResource(req, course.creatorId)) {
      return res.status(403).json({ success: false, error: 'Từ chối quyền: Không sở hữu khóa học', code: 'FORBIDDEN' });
    }
    const { userId: _u, creatorId: _c, status, ...updates } = req.body;
    if (status) {
      course = creatorStore.setCourseStatus(courseId, course.creatorId, status);
    }
    if (Object.keys(updates).length > 0) {
      await externalizeSlideImages(updates.syllabus);
      await externalizeSlideImages(updates.chapters);
      course = creatorStore.updateCourse(courseId, course.creatorId, updates);
    }
    res.json({ success: true, course });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const handleCourseStatusChange = (req: express.Request, res: express.Response, status: ProductStatus) => {
  const course = creatorStore.getCourse(req.params.id);
  if (!course) return res.status(404).json({ success: false, error: 'Không tìm thấy khóa học' });
  if (!canManageCreatorResource(req, course.creatorId)) {
    return res.status(403).json({ success: false, error: 'Từ chối quyền', code: 'FORBIDDEN' });
  }
  try {
    res.json({ success: true, course: creatorStore.setCourseStatus(course.id, course.creatorId, status) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
};
app.post('/api/creator/courses/:id/publish', requireAuth, (req, res) => handleCourseStatusChange(req, res, 'PUBLISHED'));
app.post('/api/creator/courses/:id/unpublish', requireAuth, (req, res) => handleCourseStatusChange(req, res, 'UNPUBLISHED'));

app.delete('/api/creator/courses/:id', requireAuth, (req, res) => {
  const course = creatorStore.getCourse(req.params.id);
  if (!course) return res.json({ success: false });
  if (!canManageCreatorResource(req, course.creatorId)) {
    return res.status(403).json({ success: false, error: 'Từ chối quyền: Không sở hữu khóa học', code: 'FORBIDDEN' });
  }
  res.json({ success: creatorStore.deleteCourse(course.id) });
});

// 6.5 Creator Sales & Orders (own sales only)
app.get('/api/creator/sales', requireAuth, (req, res) => {
  const authUser = getAuthUser(req)!;
  const requested = req.query.userId as string | undefined;
  const uid = isAdminUser(authUser) && requested ? requested : authUser.id;
  const rawSales = creatorStore.getCreatorSales(uid);
  const sales = rawSales.map((s) => ({
    id: s.id,
    orderId: s.orderId || s.orderCode || s.id,
    productTitle: s.productTitle,
    buyerName: s.buyerEmail || 'Học viên Kỹ thuật',
    amount: s.unitPrice,
    creatorEarnings: Math.round(s.unitPrice * 0.85),
    createdAt: s.createdAt,
    // Legacy sales (before payment modes) all came from the simulated checkout
    isMock: s.isMock !== false,
    status: s.isMock !== false ? 'MOCK' : 'COMPLETED',
  }));
  res.json({ success: true, sales });
});

// ============================================================================
// 7. ADMIN DASHBOARD API ROUTES (STRICT SERVER-SIDE AUTHORIZATION)
// ============================================================================

function getUnifiedCoursesList() {
  const creatorCourses = creatorStore.listAllCourses();
  const creatorMap = new Map(creatorCourses.map((c) => [c.id, c]));
  const enrollments = listAllCourseEnrollments();
  const orders = Array.from(serverOrdersStore.values()).filter((o) => o.status === 'paid');

  const systemCourseDefs: any[] = [];

  const results: any[] = [];
  const seenIds = new Set<string>();

  for (const sys of systemCourseDefs) {
    seenIds.add(sys.id);
    const override = creatorMap.get(sys.id);
    const courseOrders = orders.filter((o) => o.productId === sys.id);
    const courseEnrollments = enrollments.filter((e) => e.courseId === sys.id);
    const uniqueStudents = new Set([
      ...courseOrders.map((o) => o.userId),
      ...courseEnrollments.map((e) => e.userId),
    ]).size;
    const revenue = courseOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    results.push({
      id: sys.id,
      title: override?.title || sys.title,
      author: override?.creatorName || sys.authorName,
      creatorId: override?.creatorId || 'system',
      price: override?.price ?? sys.price,
      currency: 'VND',
      status: override?.status || 'PUBLISHED',
      chaptersCount: override?.chapters?.length || sys.chaptersCount,
      lessonsCount: override?.chapters
        ? override.chapters.reduce((acc, ch) => acc + (ch.lessons?.length || 0), 0)
        : sys.lessonsCount,
      studentsCount: uniqueStudents,
      salesCount: courseOrders.length,
      revenue,
      category: override?.category || sys.category,
      isCreatorCourse: Boolean(override && override.creatorId !== 'system'),
      updatedAt: override?.updatedAt || sys.createdAt,
      createdAt: override?.createdAt || sys.createdAt,
    });
  }

  for (const cc of creatorCourses) {
    if (seenIds.has(cc.id)) continue;
    const courseOrders = orders.filter((o) => o.productId === cc.id);
    const courseEnrollments = enrollments.filter((e) => e.courseId === cc.id);
    const uniqueStudents = new Set([
      ...courseOrders.map((o) => o.userId),
      ...courseEnrollments.map((e) => e.userId),
    ]).size;
    const revenue = courseOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    results.push({
      id: cc.id,
      title: cc.title,
      author: cc.creatorName,
      creatorId: cc.creatorId,
      price: cc.price,
      currency: cc.currency || 'VND',
      status: cc.status || 'PUBLISHED',
      chaptersCount: cc.chapters?.length || 0,
      lessonsCount: (cc.chapters || []).reduce((acc, ch) => acc + (ch.lessons?.length || 0), 0),
      studentsCount: uniqueStudents,
      salesCount: courseOrders.length,
      revenue,
      category: cc.category || 'custom',
      isCreatorCourse: true,
      updatedAt: cc.updatedAt,
      createdAt: cc.createdAt,
    });
  }

  return results;
}

function getUnifiedMarketplaceList() {
  const creatorProducts = creatorStore.listAllProducts();
  const creatorMap = new Map(creatorProducts.map((p) => [p.id, p]));
  const orders = Array.from(serverOrdersStore.values()).filter((o) => o.status === 'paid');

  const catalogDefs = [
    {
      id: 'mkt-555-pwm-dimmer',
      title: 'Mạch Điều Khiển Độ Rộng Xung PWM NE555 Công Suất Cao',
      authorName: 'KS. Vũ Minh Quân',
      price: 0,
      category: 'analog',
      version: '2.1.0',
      componentCount: 7,
      boardType: 'rectangle',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'mkt-hbridge-l298-driver',
      title: 'Mạch Cầu H Đảo Chiều Động Cơ DC Kép Bảo Vệ Flyback',
      authorName: 'ThS. Trần Hoàng Nam',
      price: 129000,
      category: 'power',
      version: '1.4.2',
      componentCount: 8,
      boardType: 'rectangle',
      createdAt: '2026-09-02T00:00:00.000Z',
    },
    {
      id: 'mkt-esp32-iot-weather-node',
      title: 'Trạm Quan Trắc Môi Trường IoT Đa Cảm Biến Nguồn Kép',
      authorName: 'KS. Nguyễn Thành Luân',
      price: 185000,
      category: 'iot',
      version: '3.0.1',
      componentCount: 8,
      boardType: 'rectangle',
      createdAt: '2026-09-03T00:00:00.000Z',
    },
    {
      id: 'mkt-ads1115-afe-sensor',
      title: 'Mạch Khuếch Đại & Lọc Nhiễu Tín Hiệu Cảm Biến Analog (AFE)',
      authorName: 'TS. Lê Đăng Khoa',
      price: 0,
      category: 'sensor',
      version: '1.2.0',
      componentCount: 6,
      boardType: 'rectangle',
      createdAt: '2026-09-04T00:00:00.000Z',
    },
    {
      id: 'mkt-ch340g-usb-uart',
      title: 'Module Chuyển Đổi Giao Tiếp USB sang UART Cách Ly Quang',
      authorName: 'KS. Đỗ Gia Huy',
      price: 149000,
      category: 'digital',
      version: '2.0.0',
      componentCount: 6,
      boardType: 'rectangle',
      createdAt: '2026-09-05T00:00:00.000Z',
    },
    {
      id: 'mkt-tp4056-lipo-bms',
      title: 'Mạch Sạc & Bảo Vệ Pin Lithium-Ion 1S Chuẩn Công Nghiệp',
      authorName: 'KS. Vũ Minh Quân',
      price: 89000,
      category: 'power',
      version: '1.8.0',
      componentCount: 6,
      boardType: 'rectangle',
      createdAt: '2026-09-06T00:00:00.000Z',
    },
  ];

  const results: any[] = [];
  const seenIds = new Set<string>();

  for (const cat of catalogDefs) {
    seenIds.add(cat.id);
    const override = creatorMap.get(cat.id);
    const prodOrders = orders.filter((o) => o.productId === cat.id);
    const revenue = prodOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    results.push({
      id: cat.id,
      title: override?.title || cat.title,
      author: override?.creatorName || cat.authorName,
      creatorId: override?.creatorId || 'system',
      price: override?.price ?? cat.price,
      isFree: (override?.price ?? cat.price) === 0,
      currency: 'VND',
      status: override?.status || 'PUBLISHED',
      category: override?.category || cat.category,
      version: override?.currentVersionNumber || cat.version,
      componentCount: override?.componentsSummary?.length || cat.componentCount,
      boardType: cat.boardType,
      salesCount: prodOrders.length,
      revenue,
      isCreatorListing: false,
      createdAt: override?.createdAt || cat.createdAt,
      updatedAt: override?.updatedAt || cat.createdAt,
    });
  }

  for (const cp of creatorProducts) {
    if (seenIds.has(cp.id)) continue;
    const prodOrders = orders.filter((o) => o.productId === cp.id);
    const revenue = prodOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    results.push({
      id: cp.id,
      title: cp.title,
      author: cp.creatorName,
      creatorId: cp.creatorId,
      price: cp.price,
      isFree: cp.price === 0,
      currency: cp.currency || 'VND',
      status: cp.status || 'PUBLISHED',
      category: cp.category || 'custom',
      version: cp.currentVersionNumber || '1.0.0',
      componentCount: cp.componentsSummary?.length || 3,
      boardType: 'rectangle',
      salesCount: prodOrders.length,
      revenue,
      isCreatorListing: true,
      createdAt: cp.createdAt,
      updatedAt: cp.updatedAt,
    });
  }

  return results;
}

// 7.1 Verify Admin Access
app.get('/api/admin/verify', requireAdmin, (req, res) => {
  const adminUser = (req as any).adminUser;
  res.json({
    isAdmin: true,
    adminEmail: getAdminEmail(),
    user: {
      id: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      role: 'admin',
      tier: adminUser.tier,
    },
  });
});

// Shows how the server sees a request, to confirm TRUST_PROXY after deploying behind a proxy
app.get('/api/admin/request-info', requireAdmin, (req, res) => {
  res.json({
    clientIp: req.ip,
    forwardedFor: req.headers['x-forwarded-for'] || null,
    trustProxy: app.get('trust proxy'),
  });
});

// 7.2 Admin Overview Metrics (100% Real System Data)
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  const users = listAllUsers();
  const projects = listAllPersonalProjects();
  const marketplaceItems = getUnifiedMarketplaceList();
  const courses = getUnifiedCoursesList();
  const orders = Array.from(serverOrdersStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

  const newUsersCount = users.filter((u) => new Date(u.createdAt).getTime() >= sevenDaysAgo).length;
  const creatorsCount = users.filter((u) => u.tier === 'creator' || u.role === 'creator').length;
  const activeSubscriptionsCount = users.filter((u) => u.tier === 'student' || u.tier === 'creator').length;
  const publishedCircuitsCount = marketplaceItems.filter(
    (m) => String(m.status).toUpperCase() === 'PUBLISHED'
  ).length;

  const paidOrders = orders.filter((o) => String(o.status).toLowerCase() === 'paid');
  const pendingOrders = orders.filter((o) => String(o.status).toLowerCase() === 'pending');
  // Real revenue only: simulated (mock) checkouts are reported separately
  const confirmedRevenue = paidOrders.filter((o) => !isMockOrder(o)).reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const mockPaidOrders = paidOrders.filter((o) => isMockOrder(o));
  const mockRevenue = mockPaidOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  // Build 7-day time series from real orders and user signups
  const dailySeries: Array<{
    date: string;
    label: string;
    users: number;
    orders: number;
    revenue: number;
    projects: number;
  }> = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 24 * 3600 * 1000);
    const yyyyMmDd = d.toISOString().split('T')[0];
    const label = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

    const dayUsers = users.filter((u) => u.createdAt?.startsWith(yyyyMmDd)).length;
    const dayPaidOrders = paidOrders.filter((o) => (o.paidAt || o.createdAt)?.startsWith(yyyyMmDd));
    const dayOrders = orders.filter((o) => o.createdAt?.startsWith(yyyyMmDd)).length;
    const dayRevenue = dayPaidOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const dayProjects = projects.filter((p) => p.createdAt?.startsWith(yyyyMmDd)).length;

    dailySeries.push({
      date: yyyyMmDd,
      label,
      users: dayUsers,
      orders: dayOrders,
      revenue: dayRevenue,
      projects: dayProjects,
    });
  }

  const planDistribution = [
    {
      tier: 'free',
      plan: 'Starter (Free)',
      count: users.filter((u) => !u.tier || u.tier === 'free').length,
    },
    {
      tier: 'student',
      plan: 'Student Pro',
      count: users.filter((u) => u.tier === 'student').length,
    },
    {
      tier: 'creator',
      plan: 'Creator Pro',
      count: users.filter((u) => u.tier === 'creator').length,
    },
  ];

  const recentTransactions = orders.slice(0, 8).map((o) => ({
    ...o,
    orderCode: o.orderCode || o.orderId,
    productName: o.productTitle || (o as any).productName || o.productId,
    status: String(o.status || 'pending').toUpperCase(),
  }));

  res.json({
    kpis: {
      totalUsers: users.length,
      newUsers7d: newUsersCount,
      newUsersLast7d: newUsersCount,
      totalProjects: projects.length,
      sellingCircuits: publishedCircuitsCount,
      totalMarketplaceProducts: publishedCircuitsCount,
      totalCourses: courses.length,
      totalCreators: creatorsCount,
      totalTransactions: orders.length,
      paidOrdersCount: paidOrders.length,
      confirmedRevenue,
      mockRevenue,
      mockPaidOrdersCount: mockPaidOrders.length,
      paymentMode: getPaymentMode(),
      pendingOrders: pendingOrders.length,
      activeSubscriptions: activeSubscriptionsCount,
    },
    dailySeries,
    planDistribution,
    recentTransactions,
    recentUsers: users.slice(0, 8).map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      plan: u.tier || 'free',
      status: u.status || 'active',
      createdAt: u.createdAt,
      lastActiveAt: u.lastActiveAt,
    })),
    recentLogs: listSystemLogs(10),
  });
});

// 7.3 Users Management & User Detail
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = listAllUsers();
  const projects = listAllPersonalProjects();
  const enrollments = listAllCourseEnrollments();
  const entitlements = Array.from(serverEntitlementsStore.values());

  const search = String(req.query.search || '').trim().toLowerCase();
  const roleFilter = String(req.query.role || 'all').toLowerCase();
  const tierFilter = String(req.query.tier || 'all').toLowerCase();
  const statusFilter = String(req.query.status || 'all').toLowerCase();
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.max(1, parseInt(String(req.query.limit || '15'), 10) || 15);

  let enriched = users.map((u) => {
    const userProjects = projects.filter(
      (p) => p.ownerId === u.id || p.ownerEmail?.toLowerCase() === u.email.toLowerCase()
    );
    const userCourses = new Set([
      ...enrollments
        .filter((e) => e.userId === u.id || e.userEmail?.toLowerCase() === u.email.toLowerCase())
        .map((e) => e.courseId),
      ...entitlements
        .filter((ent) => ent.userId === u.id && String(ent.productId).startsWith('course-'))
        .map((ent) => ent.productId),
    ]);

    return {
      id: u.id,
      email: u.email,
      displayName: u.fullName,
      phone: u.phone || null,
      role: u.role,
      plan: u.tier || 'free',
      status: u.status || 'active',
      isVerified: Boolean(u.verifiedAt),
      createdAt: u.createdAt,
      lastActiveAt: u.lastActiveAt || u.verifiedAt || u.createdAt,
      projectsCount: userProjects.length,
      coursesCount: userCourses.size,
    };
  });

  if (search) {
    enriched = enriched.filter(
      (u) =>
        u.email.toLowerCase().includes(search) ||
        u.displayName.toLowerCase().includes(search) ||
        u.id.toLowerCase().includes(search)
    );
  }
  if (roleFilter !== 'all') {
    enriched = enriched.filter((u) => u.role.toLowerCase() === roleFilter);
  }
  if (tierFilter !== 'all') {
    enriched = enriched.filter((u) => u.plan.toLowerCase() === tierFilter);
  }
  if (statusFilter !== 'all') {
    enriched = enriched.filter((u) => u.status.toLowerCase() === statusFilter);
  }

  const total = enriched.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginated = enriched.slice((page - 1) * limit, page * limit);

  res.json({
    users: paginated,
    total,
    page,
    totalPages,
  });
});

app.get('/api/admin/users/:userId', requireAdmin, (req, res) => {
  const { userId } = req.params;
  const user = getUserById(userId) || getUserByEmail(userId);
  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  }

  const projects = listAllPersonalProjects().filter(
    (p) => p.ownerId === user.id || p.ownerEmail?.toLowerCase() === user.email.toLowerCase()
  );
  const enrollments = listAllCourseEnrollments().filter(
    (e) => e.userId === user.id || e.userEmail?.toLowerCase() === user.email.toLowerCase()
  );
  const orders = Array.from(serverOrdersStore.values())
    .filter((o) => o.userId === user.id || o.userEmail?.toLowerCase() === user.email.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const entitlements = Array.from(serverEntitlementsStore.values())
    .filter((e) => e.userId === user.id || e.userEmail?.toLowerCase() === user.email.toLowerCase())
    .map((e) => e.productTitle || e.productId);
  const activity = listSystemLogs(200).filter(
    (l) => l.actorId === user.id || l.actorEmail?.toLowerCase() === user.email.toLowerCase() || l.targetId === user.id
  );

  res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.fullName,
      phone: user.phone || null,
      role: isVerifiedAdminEmail(user.email, Boolean(user.verifiedAt)) ? 'admin' : user.role,
      plan: user.tier || 'free',
      status: user.status || 'active',
      isVerified: Boolean(user.verifiedAt),
      createdAt: user.createdAt,
      verifiedAt: user.verifiedAt,
      lastActiveAt: user.lastActiveAt || user.verifiedAt || user.createdAt,
    },
    subscription: {
      planId: user.tier || 'free',
      status: 'active',
      aiQueriesLimit: user.tier === 'creator' ? 1000 : user.tier === 'student' ? 200 : 50,
      projectsLimit: user.tier === 'creator' ? 500 : user.tier === 'student' ? 50 : 10,
    },
    projects: projects.map(({ document, ...meta }) => meta),
    courses: enrollments,
    orders,
    entitlements,
    activity,
  });
});

app.patch('/api/admin/users/:userId', requireAdmin, (req, res) => {
  const { userId } = req.params;
  const { plan, tier, role, status, displayName } = req.body;
  const targetTier = plan || tier;
  const adminUser = (req as any).adminUser;

  const updated = adminUpdateUserRecord(userId, {
    tier: targetTier,
    role,
    status,
    fullName: displayName,
  });

  if (!updated) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng để cập nhật' });
  }

  // Sync Creator entitlement if plan changed to/from creator
  if (targetTier === 'creator') {
    serverEntitlementsStore.set(`${updated.id}_plan-creator`, {
      userId: updated.id,
      userEmail: updated.email,
      productId: 'plan-creator',
      productTitle: 'Gói Chuyên Gia Sáng Tạo (Creator Max)',
      orderId: `adm_${Date.now()}`,
      grantedAt: new Date().toISOString(),
    });
    saveEntitlementsToDisk();
  } else if (targetTier === 'free' || targetTier === 'student') {
    serverEntitlementsStore.delete(`${updated.id}_plan-creator`);
    saveEntitlementsToDisk();
  }

  addSystemLog({
    level: 'info',
    category: 'admin',
    action: 'ADMIN_USER_UPDATED',
    actorId: adminUser.id,
    actorEmail: adminUser.email,
    targetId: updated.id,
    details: `Admin cập nhật tài khoản ${updated.email}: plan=${updated.tier}, role=${updated.role}, status=${updated.status || 'active'}`,
  });

  res.json({
    success: true,
    user: {
      id: updated.id,
      email: updated.email,
      displayName: updated.fullName,
      role: updated.role,
      plan: updated.tier,
      status: updated.status || 'active',
    },
  });
});

// 7.4 Transactions Management
app.get('/api/admin/transactions', requireAdmin, (req, res) => {
  const statusFilter = String(req.query.status || 'ALL').toUpperCase();
  const search = String(req.query.search || '').trim().toLowerCase();

  const orders = Array.from(serverOrdersStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  let enriched = orders.map((o) => {
    const u = getUserById(o.userId) || (o.userEmail ? getUserByEmail(o.userEmail) : undefined);
    const statusUpper = String(o.status || 'pending').toUpperCase();
    return {
      ...o,
      orderCode: o.orderCode || o.orderId,
      productName: o.productTitle || (o as any).productName || o.productId,
      type: o.orderType || 'product',
      status: statusUpper,
      userEmail: o.userEmail || u?.email || 'guest@circuitcraft.io',
      userName: u?.fullName || (o.userEmail ? o.userEmail.split('@')[0] : 'Khách'),
      paymentMethod: o.paymentMethod || (o.amount === 0 ? 'Free' : 'VietQR'),
    };
  });

  if (statusFilter !== 'ALL') {
    enriched = enriched.filter((tx) => tx.status === statusFilter);
  }
  if (search) {
    enriched = enriched.filter(
      (tx) =>
        String(tx.orderCode).toLowerCase().includes(search) ||
        String(tx.productName).toLowerCase().includes(search) ||
        String(tx.userId).toLowerCase().includes(search) ||
        String(tx.userEmail).toLowerCase().includes(search)
    );
  }

  res.json({ transactions: enriched });
});

app.patch('/api/admin/transactions/:orderId', requireAdmin, (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const adminUser = (req as any).adminUser;

  const order = serverOrdersStore.get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  }

  const normalizedStatus = String(status || '').toLowerCase();
  const allowedStatuses = ['pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded'];
  if (!allowedStatuses.includes(normalizedStatus)) {
    return res.status(400).json({ error: 'Trạng thái giao dịch không hợp lệ' });
  }

  const prevStatus = order.status;
  order.status = normalizedStatus as any;
  if (normalizedStatus === 'paid' && !order.paidAt) {
    order.paidAt = new Date().toISOString();
    serverEntitlementsStore.set(`${order.userId}_${order.productId}`, {
      userId: order.userId,
      userEmail: order.userEmail,
      productId: order.productId,
      productTitle: order.productTitle,
      orderId: order.orderId,
      grantedAt: order.paidAt,
      isMock: isMockOrder(order),
    });
    saveEntitlementsToDisk();
    if (order.productId === 'plan-creator') {
      updateUserTier(order.userId, 'creator', { mock: isMockOrder(order) });
    } else if (order.productId === 'plan-student') {
      updateUserTier(order.userId, 'student', { mock: isMockOrder(order) });
    }
  }
  serverOrdersStore.set(orderId, order);
  saveOrdersToDisk();

  addSystemLog({
    level: 'info',
    category: 'admin',
    action: 'ADMIN_ORDER_STATUS_CHANGED',
    actorId: adminUser.id,
    actorEmail: adminUser.email,
    targetId: order.orderCode || order.orderId,
    details: `Admin cập nhật trạng thái đơn hàng ${order.orderCode || order.orderId}: ${prevStatus} -> ${normalizedStatus}`,
  });

  res.json({ success: true, order });
});

// 7.5 Membership Plans Management
app.get('/api/admin/memberships', requireAdmin, (req, res) => {
  const users = listAllUsers();
  const orders = Array.from(serverOrdersStore.values()).filter((o) => o.status === 'paid');

  const plans = [
    {
      id: 'free',
      tier: 'free',
      code: 'plan-free',
      name: 'Starter (Free)',
      nameVi: 'Gói Khởi Đầu (Free)',
      price: 0,
      currency: 'VND',
      billingCycle: 'Trọn đời',
      status: 'active',
      aiQueriesQuota: 50,
      projectsQuota: 10,
      quotas: {
        maxProjects: 10,
        aiQueriesPerDay: 50,
        cloudSync: false,
        creatorStudioAccess: false,
      },
      features: ['Mô phỏng mạch 3D cơ bản', 'Truy cập khóa học miễn phí', 'Tải mẫu mạch miễn phí'],
      permissions: ['Mô phỏng mạch 3D cơ bản', 'Truy cập khóa học miễn phí', 'Tải mẫu mạch miễn phí'],
      usersCount: users.filter((u) => !u.tier || u.tier === 'free').length,
      revenue: 0,
    },
    {
      id: 'student',
      tier: 'student',
      code: 'plan-student',
      name: 'Student Pro',
      nameVi: 'Gói Học Viên STEM (Student Pro)',
      price: MEMBERSHIP_PLAN_PRICES.student,
      currency: 'VND',
      billingCycle: 'Tháng',
      status: 'active',
      aiQueriesQuota: 200,
      projectsQuota: 50,
      quotas: {
        maxProjects: 50,
        aiQueriesPerDay: 200,
        cloudSync: true,
        creatorStudioAccess: false,
      },
      features: [
        '50 Dự án lưu trữ Cloud',
        '200 Lượt hỏi trợ lý kỹ thuật Minibot AI',
        'Kiểm tra lỗi mạch tự động DRC chuyên sâu',
        'Xuất BOM & Netlist tiêu chuẩn',
      ],
      permissions: [
        '50 Dự án lưu trữ Cloud',
        '200 Lượt hỏi trợ lý kỹ thuật Minibot AI',
        'Kiểm tra lỗi mạch tự động DRC chuyên sâu',
        'Xuất BOM & Netlist tiêu chuẩn',
      ],
      usersCount: users.filter((u) => u.tier === 'student').length,
      revenue: orders
        .filter((o) => o.productId === 'plan-student' && !isMockOrder(o))
        .reduce((s, o) => s + (Number(o.amount) || 0), 0),
    },
    {
      id: 'creator',
      tier: 'creator',
      code: 'plan-creator',
      name: 'Creator Pro',
      nameVi: 'Gói Chuyên Gia Sáng Tạo (Creator Pro)',
      price: MEMBERSHIP_PLAN_PRICES.creator,
      currency: 'VND',
      billingCycle: 'Tháng',
      status: 'active',
      aiQueriesQuota: 1000,
      projectsQuota: 500,
      quotas: {
        maxProjects: 500,
        aiQueriesPerDay: 1000,
        cloudSync: true,
        creatorStudioAccess: true,
      },
      features: [
        '500 Dự án lưu trữ Cloud & Lịch sử Revision',
        '1,000 Lượt hỏi trợ lý kỹ thuật Minibot AI',
        'Mở khóa Không gian Nhà sáng tạo (Creator Studio)',
        'Đăng bán mạch 3D & khóa học trên Cửa hàng thương mại',
        'Thống kê doanh thu & học viên thời gian thực',
      ],
      permissions: [
        '500 Dự án lưu trữ Cloud & Lịch sử Revision',
        '1,000 Lượt hỏi trợ lý kỹ thuật Minibot AI',
        'Mở khóa Không gian Nhà sáng tạo (Creator Studio)',
        'Đăng bán mạch 3D & khóa học trên Cửa hàng thương mại',
        'Thống kê doanh thu & học viên thời gian thực',
      ],
      usersCount: users.filter((u) => u.tier === 'creator').length,
      revenue: orders
        .filter((o) => o.productId === 'plan-creator' && !isMockOrder(o))
        .reduce((s, o) => s + (Number(o.amount) || 0), 0),
    },
  ];

  res.json({ plans });
});

// 7.6 Course Management
app.get('/api/admin/courses', requireAdmin, (req, res) => {
  const courses = getUnifiedCoursesList().map((c) => ({
    ...c,
    source: c.isCreatorCourse ? 'creator' : 'system',
    status: String(c.status || 'published').toLowerCase(),
  }));
  res.json({ courses });
});

app.patch('/api/admin/courses/:courseId/status', requireAdmin, (req, res) => {
  const { courseId } = req.params;
  const { status, action } = req.body;
  const adminUser = (req as any).adminUser;

  const actionMap: Record<string, string> = {
    approve: 'PUBLISHED',
    reject: 'REJECTED',
    unpublish: 'DRAFT',
    archive: 'ARCHIVED',
  };
  const resolvedStatus = (action ? actionMap[action] : status) || 'PUBLISHED';

  const existingList = getUnifiedCoursesList();
  const target = existingList.find((c) => c.id === courseId);
  if (!target) {
    return res.status(404).json({ error: 'Không tìm thấy khóa học' });
  }

  const updated = creatorStore.adminSetCourseStatus(courseId, resolvedStatus as ProductStatus, {
    title: target.title,
    creatorId: target.creatorId,
    creatorName: target.author,
    price: target.price,
    category: target.category,
  });

  addSystemLog({
    level: 'info',
    category: 'course',
    action: 'ADMIN_COURSE_MODERATION',
    actorId: adminUser.id,
    actorEmail: adminUser.email,
    targetId: courseId,
    details: `Admin cập nhật trạng thái khóa học "${target.title}": ${resolvedStatus}`,
  });

  res.json({ success: true, course: updated });
});

// 7.7 Projects & Circuits Management
app.get('/api/admin/projects', requireAdmin, (req, res) => {
  const personalProjects = listAllPersonalProjects().map(({ document, ...meta }) => ({
    ...meta,
    projectId: meta.id,
    title: meta.name,
    status: 'saved',
  }));
  const marketplaceProducts = getUnifiedMarketplaceList().map((mp) => ({
    ...mp,
    ownerName: mp.author,
    status: String(mp.status || 'published').toLowerCase(),
  }));
  const projectVersions = listAllProjectVersions().map((pv) => ({
    ...pv,
    versionId: pv.id,
    versionNumber: `r${pv.revision}`,
  }));
  const productVersions = creatorStore.listAllProductVersions().map((pv) => ({
    id: pv.id,
    versionId: pv.id,
    projectId: pv.productId,
    projectName: pv.projectSnapshot?.name || pv.productId,
    ownerId: 'creator',
    ownerEmail: 'creator@circuitcraft.io',
    revision: pv.version,
    versionNumber: `v${pv.version}`,
    note: pv.changelog || `Product Version v${pv.version}`,
    componentCount: Array.isArray(pv.projectSnapshot?.components) ? pv.projectSnapshot.components.length : 0,
    createdAt: pv.createdAt,
  }));

  const mergedVersions = [...projectVersions, ...productVersions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json({
    personalProjects,
    marketplaceProducts,
    projectVersions: mergedVersions,
    versions: mergedVersions,
  });
});

// 7.8 Marketplace Management
app.get('/api/admin/marketplace', requireAdmin, (req, res) => {
  const listings = getUnifiedMarketplaceList().map((item) => ({
    ...item,
    creatorName: item.author,
    source: item.isCreatorListing ? 'creator' : 'system',
    status: String(item.status || 'published').toLowerCase(),
  }));
  res.json({
    products: listings,
    listings,
    summary: {
      total: listings.length,
      free: listings.filter((i) => i.isFree).length,
      paid: listings.filter((i) => !i.isFree).length,
      published: listings.filter((i) => i.status === 'published').length,
      pending: listings.filter((i) => i.status === 'pending').length,
    },
  });
});

app.patch('/api/admin/marketplace/:productId/status', requireAdmin, (req, res) => {
  const { productId } = req.params;
  const { status, action } = req.body;
  const adminUser = (req as any).adminUser;

  const actionMap: Record<string, string> = {
    approve: 'PUBLISHED',
    reject: 'REJECTED',
    unpublish: 'DRAFT',
    archive: 'ARCHIVED',
  };
  const resolvedStatus = (action ? actionMap[action] : status) || 'PUBLISHED';

  const existingList = getUnifiedMarketplaceList();
  const target = existingList.find((p) => p.id === productId);
  if (!target) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm trên Cửa hàng' });
  }

  // Note: Updating marketplace listing status never deletes buyer entitlements in serverEntitlementsStore
  const updated = creatorStore.adminSetProductStatus(productId, resolvedStatus as ProductStatus, {
    title: target.title,
    creatorId: target.creatorId,
    creatorName: target.author,
    price: target.price,
    category: target.category,
  });

  addSystemLog({
    level: 'info',
    category: 'marketplace',
    action: 'ADMIN_MARKETPLACE_MODERATION',
    actorId: adminUser.id,
    actorEmail: adminUser.email,
    targetId: productId,
    details: `Admin cập nhật trạng thái sản phẩm "${target.title}": ${resolvedStatus} (Quyền sở hữu của người đã mua được bảo toàn)`,
  });

  res.json({ success: true, listing: updated });
});

// 7.9 Reports & Time-Range Analytics (7d, 30d, 90d - Real Data Only)
app.get('/api/admin/reports', requireAdmin, (req, res) => {
  const rangeParam = (req.query.range as string) || '30d';
  const days = rangeParam === '7d' ? 7 : rangeParam === '90d' ? 90 : 30;
  const now = Date.now();
  const cutoff = now - days * 24 * 3600 * 1000;

  const users = listAllUsers();
  const projects = listAllPersonalProjects();
  const enrollments = listAllCourseEnrollments();
  const orders = Array.from(serverOrdersStore.values());
  const creatorProducts = creatorStore.listAllProducts();
  const creatorCourses = creatorStore.listAllCourses();

  const filteredUsers = users.filter((u) => new Date(u.createdAt).getTime() >= cutoff);
  const filteredOrders = orders.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
  const filteredPaidOrders = filteredOrders.filter((o) => o.status === 'paid');
  const filteredProjects = projects.filter((p) => new Date(p.createdAt).getTime() >= cutoff);
  const filteredEnrollments = enrollments.filter((e) => new Date(e.enrolledAt).getTime() >= cutoff);

  const revenueInRange = filteredPaidOrders.filter((o) => !isMockOrder(o)).reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const mockRevenueInRange = filteredPaidOrders.filter((o) => isMockOrder(o)).reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const marketplaceSalesInRange = filteredPaidOrders.filter((o) => o.orderType === 'project').length;
  const courseSalesInRange = filteredPaidOrders.filter((o) => o.orderType === 'course').length;
  const membershipSalesInRange = filteredPaidOrders.filter((o) => o.orderType === 'membership').length;

  const timeline: Array<{
    date: string;
    label: string;
    newUsers: number;
    transactions: number;
    revenue: number;
    enrollments: number;
    projectsCreated: number;
  }> = [];

  const stepDays = days > 30 ? 3 : 1;
  for (let i = days - 1; i >= 0; i -= stepDays) {
    const startWindow = new Date(now - i * 24 * 3600 * 1000);
    const yyyyMmDd = startWindow.toISOString().split('T')[0];
    const label = `${startWindow.getDate().toString().padStart(2, '0')}/${(startWindow.getMonth() + 1).toString().padStart(2, '0')}`;

    const uCount = users.filter((u) => u.createdAt?.startsWith(yyyyMmDd)).length;
    const tCount = orders.filter((o) => o.createdAt?.startsWith(yyyyMmDd)).length;
    const rSum = orders
      .filter((o) => o.status === 'paid' && (o.paidAt || o.createdAt)?.startsWith(yyyyMmDd))
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const eCount = enrollments.filter((e) => e.enrolledAt?.startsWith(yyyyMmDd)).length;
    const pCount = projects.filter((p) => p.createdAt?.startsWith(yyyyMmDd)).length;

    timeline.push({
      date: yyyyMmDd,
      label,
      newUsers: uCount,
      transactions: tCount,
      revenue: rSum,
      enrollments: eCount,
      projectsCreated: pCount,
    });
  }

  const summaryTotals = {
    userGrowth: filteredUsers.length,
    transactionsCount: filteredOrders.length,
    paidTransactionsCount: filteredPaidOrders.length,
    revenue: revenueInRange,
    confirmedRevenue: revenueInRange,
    mockRevenue: mockRevenueInRange,
    courseEnrollments: filteredEnrollments.length,
    projectsCreated: filteredProjects.length,
    marketplaceSales: marketplaceSalesInRange,
    courseSales: courseSalesInRange,
    membershipSales: membershipSalesInRange,
    creatorActivityCount: creatorProducts.length + creatorCourses.length,
  };

  res.json({
    range: rangeParam,
    days,
    totals: summaryTotals,
    summary: summaryTotals,
    dailySeries: timeline,
    timeline,
  });
});

// 7.10 System Logs & Settings
app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const category = req.query.category as string;
  const level = (req.query.severity || req.query.level) as string;
  let logs = listSystemLogs(300);
  if (category && category !== 'all') {
    logs = logs.filter((l) => l.category === category);
  }
  if (level && level !== 'all') {
    logs = logs.filter((l) => l.level === level);
  }
  res.json({ logs });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const settings = getSystemSettings();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  res.json({
    settings,
    environment: {
      adminEmail: getAdminEmail(),
      supabaseConnected: Boolean(supabaseUrl),
      supabaseUrl: supabaseUrl ? supabaseUrl.replace(/^(https?:\/\/[^/]+).*/, '$1') : null,
      smtpConfigured,
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      paymentBankName: process.env.PAYMENT_BANK_NAME || 'MB Bank',
      paymentAccountName: process.env.PAYMENT_ACCOUNT_NAME || 'Huỳnh Phong',
    },
  });
});

app.patch('/api/admin/settings', requireAdmin, (req, res) => {
  const adminUser = (req as any).adminUser;
  const { maintenanceMode, requireCourseReview, requireMarketplaceReview, allowNewRegistrations } = req.body;
  const updated = updateSystemSettings({
    maintenanceMode,
    requireCourseReview,
    requireMarketplaceReview,
    allowNewRegistrations,
  });

  addSystemLog({
    level: 'info',
    category: 'admin',
    action: 'ADMIN_SETTINGS_UPDATED',
    actorId: adminUser.id,
    actorEmail: adminUser.email,
    details: `Admin cập nhật cài đặt hệ thống (Maintenance=${updated.maintenanceMode}, CourseReview=${updated.requireCourseReview}, MarketplaceReview=${updated.requireMarketplaceReview})`,
  });

  res.json({ success: true, settings: updated });
});

// Explicit API 404 handler so unknown API requests return JSON rather than SPA index.html
app.all('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
  });
});

// Uniform JSON errors for the API: no stack traces, no HTML error pages
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent || !(req.baseUrl + req.path).startsWith('/api')) return next(err);
  if (err?.type === 'entity.parse.failed') {
    const message = 'Dữ liệu gửi lên không phải JSON hợp lệ.';
    return res.status(400).json({ success: false, error: message, message, code: 'INVALID_JSON' });
  }
  if (err?.type === 'entity.too.large') {
    const message = 'Dữ liệu gửi lên vượt quá dung lượng cho phép của chức năng này.';
    return res.status(413).json({ success: false, error: message, message, code: 'PAYLOAD_TOO_LARGE' });
  }
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    const message = 'Yêu cầu không hợp lệ.';
    return res.status(err.status).json({ success: false, error: message, message, code: 'BAD_REQUEST' });
  }
  console.error(`[API] ${req.method} ${req.originalUrl}:`, err?.message || err);
  const message = 'Máy chủ gặp lỗi khi xử lý yêu cầu.';
  res.status(500).json({ success: false, error: message, message, code: 'INTERNAL_ERROR' });
});

export default app;
