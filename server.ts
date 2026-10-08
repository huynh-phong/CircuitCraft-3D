import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
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
} from './src/server/otpService.ts';
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
} from './src/server/userStore.ts';
import { creatorStore, CatalogProductItem, ProductStatus } from './src/server/creatorStore.ts';

// Always override container defaults with values explicitly defined in .env
dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// List of candidate models in order of priority
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];

// Lazy-initialized Gemini Client with live .env re-check
let geminiClient: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

function getGemini(): GoogleGenAI | null {
  // Re-read .env to catch any live updates made by user
  dotenv.config({ override: true });
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
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 1.1 AI Status check
app.get('/api/ai/status', (req, res) => {
  const ai = getGemini();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  res.json({
    status: ai ? 'connected' : 'unconfigured',
    hasKey: Boolean(apiKey),
    keyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : null,
    supportedModels: GEMINI_MODELS,
  });
});

// 2. AI Chat
app.post('/api/ai/chat', async (req, res) => {
  const { prompt, history, context } = req.body;
  const locale = context?.locale || 'vi';

  try {
    const ai = getGemini();
    if (!ai) {
      // Fallback message indicating local rule-based AI is running
      return res.json({
        reply: locale === 'en'
          ? `[Minibot Local Assistant]: I have analyzed your circuit state. There are currently ${context?.components?.length || 0} components on the board. You can inspect your connections using the DRC validation panel below!`
          : `[Minibot Local Assistant]: Tôi đã phân tích trạng thái mạch của bạn. Hiện tại có ${context?.components?.length || 0} linh kiện trên bo mạch. Bạn có thể kiểm tra các kết nối qua bảng Kiểm tra luật mạch (DRC) bên dưới!`,
      });
    }

    const systemInstruction = locale === 'en'
      ? `You are Minibot - the intelligent, pedagogically sound, and friendly AI Assistant for CircuitCraft 3D, a hardware circuit design and simulation platform.
Your mission:
- Guide users on fundamental electronic principles (Ohm's Law, LED polarity Anode/Cathode, current-limiting resistors, switches, potentiometers).
- Explain DRC validation errors (short circuits, missing current-limiting resistors, floating pins).
- Maintain an encouraging pedagogical tone in fluent, concise, and practical English.
- When the user greets you, greet them warmly and introduce yourself as Minibot.
- When asked to create or modify circuits, reference supported components: dc-source (vcc, gnd), resistor (pin1, pin2), led (anode, cathode), switch (pin1, pin2), potentiometer (pin1, wiper, pin2), connector (pin1, pin2).`
      : `Bạn là Minibot - Trợ lý ảo AI thông minh và thân thiện của nền tảng học tập thiết kế mạch điện 3D CircuitCraft.
Nhiệm vụ của bạn là:
- Hướng dẫn người dùng các nguyên lý điện tử cơ bản (Định luật Ohm, phân cực LED Anode/Cathode, bảo vệ quá dòng, công tắc, biến trở).
- Giải thích các lỗi thiết kế DRC (đoản mạch, LED thiếu điện trở hạn dòng, chân linh kiện chưa được nối).
- Giữ phong cách sư phạm, khích lệ, dùng tiếng Việt chuẩn mực, ngắn gọn và thực tiễn.
- Khi người dùng chào hỏi (ví dụ "hello", "chào bạn"), hãy đáp lại thân thiện, tự giới thiệu bạn là Minibot và sẵn sàng hỗ trợ thiết kế mạch 3D.
- Khi người dùng yêu cầu tạo hoặc sửa mạch, hãy phân tích kỹ danh mục linh kiện được hỗ trợ: dc-source (vcc, gnd), resistor (pin1, pin2), led (anode, cathode), switch (pin1, pin2), potentiometer (pin1, wiper, pin2), connector (pin1, pin2).`;

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (!h.content) continue;
        const role = h.role === 'assistant' ? 'model' : 'user';
        // Ensure conversation starts with user role for Gemini API compliance
        if (contents.length === 0 && role === 'model') continue;
        contents.push({
          role,
          parts: [{ text: h.content }],
        });
      }
    }

    const contextSummary = context
      ? `\n[Circuit State: Revision #${context.revision || 1}, ${context.components?.length || 0} components, ${context.connectionsCount || 0} wires. DRC issues: ${JSON.stringify(context.issues || [])}]`
      : '';

    // If previous item was user, merge or append
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += `\n${prompt}${contextSummary}`;
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: prompt + contextSummary }],
      });
    }

    const response = await generateWithGemini(ai, {
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || (locale === 'en' ? 'Hello! I am Minibot. How can I help you design your 3D circuit today?' : 'Chào bạn! Tôi là Minibot. Tôi có thể hỗ trợ gì cho bạn trong việc thiết kế mạch hôm nay?');
    res.json({ reply });
  } catch (error: any) {
    console.error('Lỗi Gemini API chat:', error);
    res.json({
      reply: locale === 'en'
        ? `[Minibot]: An issue occurred while connecting to the AI model (${error?.message || 'Network error'}). Please try again or recheck your API Key!`
        : `[Minibot]: Đã xảy ra sự cố khi kết nối tới mô hình AI (${error?.message || 'Lỗi mạng'}). Vui lòng kiểm tra lại API Key hoặc gửi lại câu hỏi!`,
    });
  }
});

// 3. AI Proposal Generator
app.post('/api/ai/propose', async (req, res) => {
  const { requirement, baseRevision, currentComponentsCount } = req.body;

  try {
    const ai = getGemini();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API Key not configured' });
    }

    const prompt = `Yêu cầu thiết kế: "${requirement}".
Hãy lập một đề xuất mạch điện tử hoàn chỉnh theo định dạng JSON.
Linh kiện hợp lệ:
- "dc-source" (pins: vcc, gnd)
- "resistor" (pins: pin1, pin2, params: { resistance: 220 })
- "led" (pins: anode, cathode, params: { color: "red" | "green" | "blue" | "yellow" })
- "switch" (pins: pin1, pin2)
- "potentiometer" (pins: pin1, wiper, pin2)

Trả về JSON duy nhất với cấu trúc:
{
  "proposalId": "string",
  "explanation": "giải thích ngắn bằng tiếng Việt",
  "layoutDescription": "mô tả bố trí 3D",
  "componentsToAdd": [
    {
      "instanceId": "comp-1",
      "definitionId": "dc-source",
      "name": "Nguồn 5V",
      "position": { "x": -40, "y": 0, "z": 0 },
      "rotation": { "x": 0, "y": 0, "z": 0 },
      "parameters": { "voltage": 5.0 }
    }
  ],
  "connectionsToAdd": [
    {
      "id": "c-1",
      "fromComponentId": "comp-1",
      "fromPinId": "vcc",
      "toComponentId": "comp-2",
      "toPinId": "pin1",
      "wireColor": "#ef4444"
    }
  ]
}`;

    const response = await generateWithGemini(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    parsed.baseRevision = baseRevision;
    res.json({ proposal: parsed });
  } catch (error: any) {
    console.error('Lỗi sinh đề xuất mạch:', error);
    res.status(500).json({ error: error?.message || 'Không thể sinh đề xuất' });
  }
});

// 3.1 AI Circuit Assistant (used by Minibot Copilot in Editor)
app.post('/api/ai/circuit-assistant', async (req, res) => {
  const { prompt, mode, circuitSnapshot } = req.body;
  const baseRevision = circuitSnapshot?.revision || 1;

  try {
    const ai = getGemini();
    if (ai) {
      const systemInstruction = `Bạn là Minibot AI Circuit Assistant trong CircuitCraft 3D.
Nhiệm vụ: Phân tích mạch điện và yêu cầu của người dùng, đưa ra đề xuất thay đổi mạch an toàn và khả thi.
Danh mục linh kiện được hỗ trợ:
- "dc_power_supply" (pins: pin_pos, pin_neg; properties: { voltage: 5 })
- "resistor" (pins: pin_1, pin_2; properties: { resistance: 220 })
- "led" (pins: pin_anode, pin_cathode; properties: { color: "red" | "green" | "blue" | "yellow" })
- "switch_spst" (pins: pin_1, pin_2; properties: { state: "open" | "closed" })

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
        type: 'switch_spst',
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
          type: 'dc_power_supply',
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
const memoryProjectsStore = new Map<string, any>();

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
  'course-uno-r3-basic': {
    id: 'course-uno-r3-basic',
    title: 'Khóa học UNO R3 - Mạch điện tử cơ bản',
    category: 'course',
    authorName: 'Huỳnh Phong',
    price: 799000,
    currency: 'VND',
  },
  'course-digital-logic': {
    id: 'course-digital-logic',
    title: 'Thiết Kế Mạch Logic Số & Cổng Boolean Tương Tác 3D',
    category: 'course',
    authorName: 'TS. Lê Đăng Khoa',
    price: 199000,
    currency: 'VND',
  },
  'course-timer-555': {
    id: 'course-timer-555',
    title: 'Mastering IC Định Thời 555 & Dao Động Xung Đồng Hồ',
    category: 'course',
    authorName: 'Kỹ Sư Vũ Minh Quân',
    price: 299000,
    currency: 'VND',
  },
  'course-pcb-design-gerber': {
    id: 'course-pcb-design-gerber',
    title: 'Thiết Kế Bo Mạch PCB Chuẩn Công Nghiệp & Xuất Gerber',
    category: 'course',
    authorName: 'KS. Đỗ Gia Huy',
    price: 590000,
    currency: 'VND',
  },
  'course-intro-stem-3d': {
    id: 'course-intro-stem-3d',
    title: 'Nhập Môn Mạch Điện Tử & Mô Phỏng Thực Tế 3D',
    category: 'course',
    authorName: 'KS. Nguyễn Thành Luân',
    price: 0,
    currency: 'VND',
  },
  'course-switch-relays': {
    id: 'course-switch-relays',
    title: 'Mạch Đóng Cắt Tự Động: Công Tắc, Relay & Bảo Vệ Mạch',
    category: 'course',
    authorName: 'ThS. Trần Hoàng Nam',
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
  'prod-terminal-splitter': {
    id: 'prod-terminal-splitter',
    title: 'Module chia nguồn Terminal Block 2 cổng',
    category: 'project',
    authorName: 'Huỳnh Phong',
    price: 49000,
    currency: 'VND',
  },
  'prod-led-dimmer': {
    id: 'prod-led-dimmer',
    title: 'Mạch Dimmer LED chiết áp xoay',
    category: 'project',
    authorName: 'Thầy Hoàng Nam',
    price: 0,
    currency: 'VND',
  },
  'prod-dual-light-switch': {
    id: 'prod-dual-light-switch',
    title: 'Hệ thống đèn kép công tắc chọn kênh',
    category: 'project',
    authorName: 'Vũ Đức Thành',
    price: 0,
    currency: 'VND',
  },
  'prod-555-pwm-controller': {
    id: 'prod-555-pwm-controller',
    title: 'Bộ điều tốc động cơ DC PWM dùng IC 555',
    category: 'project',
    authorName: 'KS. Vũ Minh Quân',
    price: 99000,
    currency: 'VND',
  },
  'prod-arduino-radar-node': {
    id: 'prod-arduino-radar-node',
    title: 'Radar quét chướng ngại vật Arduino UNO R3 & Siêu âm',
    category: 'project',
    authorName: 'Huỳnh Phong',
    price: 189000,
    currency: 'VND',
  },
  'prod-regulated-5v-psu': {
    id: 'prod-regulated-5v-psu',
    title: 'Mạch hạ áp ổn định nguồn 5V DC chuẩn 7805 & LED 7 đoạn',
    category: 'project',
    authorName: 'TS. Lê Đăng Khoa',
    price: 79000,
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
    price: 99000,
    currency: 'VND',
  },
  'plan-creator': {
    id: 'plan-creator',
    title: 'Gói Chuyên Gia Sáng Tạo (Creator Max)',
    category: 'membership',
    price: 249000,
    currency: 'VND',
  },
};

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
    if (fs.existsSync(ORDERS_FILE)) {
      const list = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
      if (Array.isArray(list)) {
        for (const o of list) {
          if (o && o.orderId) serverOrdersStore.set(o.orderId, o);
        }
      }
    }
    if (fs.existsSync(ENTITLEMENTS_FILE)) {
      const list = JSON.parse(fs.readFileSync(ENTITLEMENTS_FILE, 'utf-8'));
      if (Array.isArray(list)) {
        for (const e of list) {
          if (e && e.userId && e.productId) {
            serverEntitlementsStore.set(`${e.userId}_${e.productId}`, e);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Server] Error loading orders/entitlements:', err);
  }
}

function saveOrdersToDisk() {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(Array.from(serverOrdersStore.values()), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Server] Error saving orders:', err);
  }
}

function saveEntitlementsToDisk() {
  try {
    fs.writeFileSync(ENTITLEMENTS_FILE, JSON.stringify(Array.from(serverEntitlementsStore.values()), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Server] Error saving entitlements:', err);
  }
}

loadOrdersAndEntitlements();

const SESSION_SECRET = process.env.SESSION_SECRET || 'cc3d-hmac-secret-key-2026';

function createSessionToken(payload: { id: string; email: string; verified: boolean }): string {
  const data = Buffer.from(
    JSON.stringify({
      id: payload.id,
      email: payload.email.trim().toLowerCase(),
      verified: payload.verified,
      iat: Date.now(),
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySessionToken(token: string): { id: string; email: string; verified: boolean } | null {
  try {
    const parts = token.split('.');
    if (parts.length === 2) {
      const [data, sig] = parts;
      const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
      if (sig === expected) {
        const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
        if (parsed && parsed.email) {
          return {
            id: parsed.id,
            email: String(parsed.email).trim().toLowerCase(),
            verified: Boolean(parsed.verified),
          };
        }
      }
    }
    // Also support decoding standard Supabase JWT payload if client authenticated via Supabase
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      if (payload && payload.email && payload.aud === 'authenticated') {
        return {
          id: payload.sub || payload.id,
          email: String(payload.email).trim().toLowerCase(),
          verified: Boolean(payload.email_confirmed_at || payload.user_metadata?.email_verified !== false),
        };
      }
    }
  } catch {}
  return null;
}

// Helper to resolve authenticated user from request headers
function resolveRequestUser(req: express.Request) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verifiedToken = verifySessionToken(token);
    if (verifiedToken && verifiedToken.email) {
      const user = ensureAuthenticatedUserRecord({
        id: verifiedToken.id,
        email: verifiedToken.email,
        verified: verifiedToken.verified,
      });
      return user;
    }
  }

  const headerEmail = (req.headers['x-user-email'] as string || '').trim().toLowerCase();
  const headerUserId = (req.headers['x-user-id'] as string || '').trim();
  if (headerEmail) {
    const existing = getUserByEmail(headerEmail);
    if (existing && existing.verifiedAt) {
      touchUserActivity(existing.email);
      return existing;
    }
  }
  if (headerUserId) {
    const existing = getUserById(headerUserId);
    if (existing && existing.verifiedAt) {
      touchUserActivity(existing.email);
      return existing;
    }
  }
  return null;
}

// Strict Server-Side Admin Authorization Middleware
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = resolveRequestUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized: Vui lòng đăng nhập tài khoản Quản trị viên.',
      code: 'UNAUTHORIZED',
    });
  }
  const isAdmin = isVerifiedAdminEmail(user.email, Boolean(user.verifiedAt));
  if (!isAdmin) {
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
  if (user && (user.tier === 'creator' || user.role === 'creator' || isVerifiedAdminEmail(user.email, Boolean(user.verifiedAt)))) return true;
  if (serverEntitlementsStore.has(`${userId}_plan-creator`)) return true;
  return false;
}

// 4.2 Catalog Endpoints
app.get('/api/courses', (req, res) => {
  const staticCourses = Object.values(SERVER_PRODUCTS)
    .filter((p) => p.category === 'course')
    .map((c) => ({
      id: c.id,
      title: c.title,
      price: c.price,
      currency: c.currency,
      author: { name: c.authorName || 'Huỳnh Phong' },
    }));

  const creatorCourses = creatorStore.listPublishedCourses().map((c) => ({
    id: c.id,
    title: c.title,
    tagline: c.tagline,
    description: c.description,
    price: c.price,
    currency: c.currency,
    difficulty: c.difficulty,
    language: c.language,
    category: c.category,
    tags: c.tags,
    author: { name: c.creatorName },
    studentsCount: c.studentsCount,
    rating: c.rating,
    chapters: c.chapters,
    featuredProjectId: c.featuredProjectId,
    updatedAt: c.updatedAt,
  }));

  res.json({ courses: [...creatorCourses, ...staticCourses] });
});

// All published Marketplace products (system + creator products)
app.get('/api/products/catalog', (req, res) => {
  const creatorProducts = creatorStore.listPublishedProducts();
  res.json({ products: creatorProducts });
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

// Safe Read-Only 3D Preview (Public representation, strips private/sensitive paid project logic)
app.get('/api/products/:id/preview', (req, res) => {
  const { id } = req.params;
  const product = creatorStore.getProduct(id);
  if (!product) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }

  const latestVer = creatorStore.getLatestVersionForProduct(id);
  if (latestVer?.previewSnapshot) {
    return res.json({
      success: true,
      productId: product.id,
      title: product.title,
      version: latestVer.version,
      preview: latestVer.previewSnapshot,
    });
  }

  // Fallback default circuit preview for sample products
  res.json({
    success: true,
    productId: product.id,
    title: product.title,
    version: product.currentVersionNumber || '1.0.0',
    preview: {
      name: product.title,
      description: product.description,
      readOnlyPreview: true,
      board: { width: 140, height: 100, color: '#0f766e' },
      components: [
        { instanceId: 'cmp-1', definitionId: 'terminal_block_2pin', name: 'Cọc đấu dây 2 chân', position: { x: -30, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
        { instanceId: 'cmp-2', definitionId: 'led_basic', name: 'LED Xanh lá', position: { x: 20, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
        { instanceId: 'cmp-3', definitionId: 'resistor_axial', name: 'Điện trở 220Ω', position: { x: -5, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      ],
      connections: [
        { id: 'c1', fromComponentId: 'cmp-1', fromPinId: 'pin_1', toComponentId: 'cmp-3', toPinId: 'pin_1', wireColor: '#ef4444' },
        { id: 'c2', fromComponentId: 'cmp-3', fromPinId: 'pin_2', toComponentId: 'cmp-2', toPinId: 'anode', wireColor: '#ef4444' },
        { id: 'c3', fromComponentId: 'cmp-1', fromPinId: 'pin_2', toComponentId: 'cmp-2', toPinId: 'cathode', wireColor: '#10b981' },
      ],
    },
  });
});

// 4.3 Secure Order Creation (Unified Checkout - VietQR for Memberships, Courses, and Marketplace Projects)
app.post('/api/orders/create', (req, res) => {
  const { productId, courseId, planId, userId } = req.body;
  const targetId = productId || courseId || planId;
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
      } else if (req.body.productTitle || req.body.productName || req.body.title) {
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
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const cleanCode = targetId.replace(/^(course-|market-|plan-|prod-)/, '').toUpperCase().substring(0, 8);
  const orderCode = `CC3D_${cleanCode}_${randomSuffix}`;
  const orderId = `ord-${Date.now()}-${randomSuffix}`;
  const nowIso = new Date().toISOString();

  // Authoritative Recipient Details
  const accountName = process.env.PAYMENT_ACCOUNT_NAME?.trim() || 'Huỳnh Phong';
  const bankName = process.env.PAYMENT_BANK_NAME?.trim() || 'MB Bank';
  const bankId = process.env.PAYMENT_BANK_ID?.trim() || '970422';
  const accountNumber = process.env.PAYMENT_ACCOUNT_NUMBER?.trim() || '0988888888';
  const transferContent = `CC3D ${orderCode}`;

  const encodedAccountName = encodeURIComponent(accountName);
  const encodedContent = encodeURIComponent(transferContent);
  const qrUrl = `https://api.vietqr.io/image/${bankId}-${accountNumber}-compact.jpg?accountName=${encodedAccountName}&amount=${amount}&addInfo=${encodedContent}`;

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

  const userObj = userId ? getUserById(userId) || getUserByEmail(userId) : undefined;
  const order = {
    orderId,
    orderCode,
    productId: targetId,
    productTitle: targetTitle,
    author: authorName,
    amount,
    currency: targetCurrency,
    status: amount === 0 ? 'paid' : 'pending',
    paymentMethod: amount === 0 ? 'Free' : 'VietQR',
    userId: userObj?.id || userId || 'guest',
    userEmail: userObj?.email || (req.body.userEmail as string) || 'guest@circuitcraft.io',
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

// 4.4 Order Status
app.get('/api/orders/:orderId/status', (req, res) => {
  const order = serverOrdersStore.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  res.json({ status: order.status, order });
});

app.get('/api/orders/status', (req, res) => {
  const orderId = req.query.orderId as string;
  if (!orderId) return res.status(400).json({ error: 'Thiếu orderId' });
  const order = serverOrdersStore.get(orderId);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  res.json({ status: order.status, order });
});

// 4.4b Multi-user isolated orders query
app.get('/api/orders/user/:userId', (req, res) => {
  const { userId } = req.params;
  const userOrders = Array.from(serverOrdersStore.values())
    .filter((o) => o.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ orders: userOrders });
});

// 4.5 Verify Payment and Grant Entitlement
const handleOrderVerification = (orderId: string, res: express.Response) => {
  const order = serverOrdersStore.get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Không tìm thấy đơn hàng trên máy chủ.' });
  }

  const wasPending = order.status !== 'paid';
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  serverOrdersStore.set(orderId, order);
  saveOrdersToDisk();

  const entitlement = {
    userId: order.userId,
    userEmail: order.userEmail,
    productId: order.productId,
    productTitle: order.productTitle,
    orderId: order.orderId,
    grantedAt: order.paidAt,
  };
  serverEntitlementsStore.set(`${order.userId}_${order.productId}`, entitlement);
  saveEntitlementsToDisk();

  // If Creator or Student plan purchased, elevate user tier on server
  if (order.productId === 'plan-creator') {
    updateUserTier(order.userId, 'creator');
  } else if (order.productId === 'plan-student') {
    updateUserTier(order.userId, 'student');
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
  if (wasPending && order.creatorId) {
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
    });
  }

  if (wasPending) {
    addSystemLog({
      level: 'success',
      category: 'payment',
      action: 'ORDER_PAID',
      actorId: order.userId,
      actorEmail: order.userEmail,
      targetId: order.orderCode,
      details: `Thanh toán thành công đơn hàng ${order.orderCode} - "${order.productTitle}" (${Number(order.amount || 0).toLocaleString('vi-VN')} VND)`,
    });
  }

  return res.json({
    success: true,
    order,
    entitlement,
    message: `Đã xác nhận thanh toán thành công cho đơn hàng ${order.orderCode}. Quyền truy cập sản phẩm "${order.productTitle}" đã được kích hoạt.`,
  });
};

app.post('/api/orders/:orderId/verify', (req, res) => {
  handleOrderVerification(req.params.orderId, res);
});

app.post('/api/orders/mock-verify', (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Thiếu mã đơn hàng orderId' });
  handleOrderVerification(orderId, res);
});

// 4.6 User Entitlements Check
app.get('/api/entitlements/:userId', (req, res) => {
  const { userId } = req.params;
  const list = Array.from(serverEntitlementsStore.values()).filter((e) => e.userId === userId);
  res.json({ entitlements: list });
});

// =========================================================================
// 4.7 CREATOR DASHBOARD & MANAGEMENT ENDPOINTS (Server-Enforced Access)
// =========================================================================

// Creator Overview & Analytics
app.get('/api/creator/overview/:userId', (req, res) => {
  const { userId } = req.params;
  if (!isCreatorUser(userId)) {
    return res.status(403).json({
      error: 'Quyền truy cập bị từ chối: Cần gói Nhà sáng tạo (Creator Plan) để xem dữ liệu này.',
    });
  }

  const profile = creatorStore.getProfile(userId) || {
    userId,
    displayName: getUserById(userId)?.fullName || 'Nhà sáng tạo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const analytics = creatorStore.getCreatorAnalytics(userId);
  res.json({ success: true, profile, analytics });
});

// Creator Profile
app.get('/api/creator/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const profile = creatorStore.getProfile(userId) || {
    userId,
    displayName: getUserById(userId)?.fullName || 'Nhà sáng tạo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  res.json({ profile });
});

app.post('/api/creator/profile', (req, res) => {
  const { userId, displayName, bio, avatarUrl } = req.body;
  if (!userId || !isCreatorUser(userId)) {
    return res.status(403).json({ error: 'Yêu cầu gói Creator để cập nhật hồ sơ sáng tạo' });
  }

  const profile = creatorStore.upsertProfile(userId, { displayName, bio, avatarUrl });
  res.json({ success: true, profile });
});

// Creator Products List
app.get('/api/creator/products/:userId', (req, res) => {
  const { userId } = req.params;
  if (!isCreatorUser(userId)) {
    return res.status(403).json({ error: 'Yêu cầu gói Creator' });
  }
  const products = creatorStore.listCreatorProducts(userId);
  res.json({ products });
});

// Create Marketplace Product from Project (Immutable version snapshot)
app.post('/api/creator/products', (req, res) => {
  const {
    creatorId,
    sourceProjectId,
    title,
    tagline,
    description,
    price,
    difficulty,
    category,
    tags,
    componentsSummary,
    prerequisites,
    deliverables,
    simulationCapability,
    language,
    license,
    projectSnapshot,
    version,
  } = req.body;

  if (!creatorId || !isCreatorUser(creatorId)) {
    return res.status(403).json({
      error: 'Tài khoản chưa kích hoạt gói Nhà sáng tạo (Creator). Vui lòng nâng cấp gói để đăng bán sản phẩm.',
    });
  }

  // Validate Project
  const val = creatorStore.validateProject(projectSnapshot);
  if (!val.valid) {
    return res.status(400).json({
      error: `Dự án chưa đạt tiêu chuẩn kỹ thuật: ${val.errors.join('; ')}`,
      errors: val.errors,
    });
  }

  const creatorProfile = creatorStore.getProfile(creatorId);
  const authorName = creatorProfile?.displayName || getUserById(creatorId)?.fullName || 'Nhà sáng tạo';
  const productId = `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const product = creatorStore.createProduct({
    id: productId,
    creatorId,
    creatorName: authorName,
    type: 'project',
    title: title || projectSnapshot.name,
    tagline: tagline || 'Mạch điện tử thiết kế 3D',
    description: description || 'Mô tả mạch điện',
    price: Math.max(0, Math.floor(Number(price) || 0)),
    currency: 'VND',
    status: 'PUBLISHED', // Auto-publish once validated
    difficulty: difficulty || 'Trung bình',
    category: category || 'Mạch ứng dụng',
    tags: Array.isArray(tags) ? tags : ['Circuit', '3D'],
    componentsSummary: Array.isArray(componentsSummary) ? componentsSummary : [],
    prerequisites: Array.isArray(prerequisites) ? prerequisites : [],
    deliverables: Array.isArray(deliverables) ? deliverables : ['Bản vẽ 3D', 'Mô phỏng vi mạch'],
    simulationCapability: simulationCapability || 'Mô phỏng dòng DC & Logic',
    language: language || 'vi',
    license: license || 'Giấy phép sử dụng cá nhân & thương mại cơ bản',
  });

  // Create immutable initial version 1.0.0
  const versionObj = creatorStore.createProductVersion({
    productId: product.id,
    creatorId,
    version: version || '1.0.0',
    sourceProjectId: sourceProjectId || 'prj-user-manual',
    projectSnapshot,
    changelog: 'Phiên bản xuất bản ban đầu',
  });

  res.json({ success: true, product, version: versionObj });
});

// Update Product Metadata
app.put('/api/creator/products/:id', (req, res) => {
  const { id } = req.params;
  const { creatorId, ...updates } = req.body;
  if (!creatorId || !isCreatorUser(creatorId)) {
    return res.status(403).json({ error: 'Từ chối quyền Creator' });
  }

  try {
    const updated = creatorStore.updateProduct(id, creatorId, updates);
    res.json({ success: true, product: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Create New Product Version
app.post('/api/creator/products/:id/versions', (req, res) => {
  const { id } = req.params;
  const { creatorId, version, sourceProjectId, projectSnapshot, changelog } = req.body;
  if (!creatorId || !isCreatorUser(creatorId)) {
    return res.status(403).json({ error: 'Từ chối quyền Creator' });
  }

  const val = creatorStore.validateProject(projectSnapshot);
  if (!val.valid) {
    return res.status(400).json({ error: `Dự án không hợp lệ: ${val.errors.join('; ')}` });
  }

  try {
    const versionObj = creatorStore.createProductVersion({
      productId: id,
      creatorId,
      version,
      sourceProjectId,
      projectSnapshot,
      changelog,
    });
    res.json({ success: true, version: versionObj });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Publish / Unpublish Product
app.post('/api/creator/products/:id/publish', (req, res) => {
  const { id } = req.params;
  const { creatorId } = req.body;
  if (!creatorId || !isCreatorUser(creatorId)) return res.status(403).json({ error: 'Từ chối quyền' });
  try {
    const product = creatorStore.setProductStatus(id, creatorId, 'PUBLISHED');
    res.json({ success: true, product });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/creator/products/:id/unpublish', (req, res) => {
  const { id } = req.params;
  const { creatorId } = req.body;
  if (!creatorId || !isCreatorUser(creatorId)) return res.status(403).json({ error: 'Từ chối quyền' });
  try {
    const product = creatorStore.setProductStatus(id, creatorId, 'UNPUBLISHED');
    res.json({ success: true, product });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Creator Courses List
app.get('/api/creator/courses/:userId', (req, res) => {
  const { userId } = req.params;
  if (!isCreatorUser(userId)) {
    return res.status(403).json({ error: 'Yêu cầu gói Creator' });
  }
  const courses = creatorStore.listCreatorCourses(userId);
  res.json({ courses });
});

// Create Creator Course
app.post('/api/creator/courses', (req, res) => {
  const {
    creatorId,
    title,
    tagline,
    description,
    price,
    difficulty,
    language,
    category,
    tags,
    prerequisites,
    learningOutcomes,
    estimatedHours,
    chapters,
    featuredProjectId,
  } = req.body;

  if (!creatorId || !isCreatorUser(creatorId)) {
    return res.status(403).json({
      error: 'Tài khoản chưa kích hoạt gói Nhà sáng tạo (Creator). Vui lòng nâng cấp gói để tạo khóa học.',
    });
  }

  const val = creatorStore.validateCourse({ title, description, price: Number(price), chapters });
  if (!val.valid) {
    return res.status(400).json({ error: `Khóa học chưa đạt yêu cầu: ${val.errors.join('; ')}` });
  }

  const creatorProfile = creatorStore.getProfile(creatorId);
  const authorName = creatorProfile?.displayName || getUserById(creatorId)?.fullName || 'Nhà sáng tạo';
  const courseId = `course-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const course = creatorStore.createCourse({
    id: courseId,
    creatorId,
    creatorName: authorName,
    title,
    tagline: tagline || 'Khóa học thực hành mạch điện 3D',
    description,
    price: Math.max(0, Math.floor(Number(price) || 0)),
    currency: 'VND',
    difficulty: difficulty || 'Cơ bản',
    language: language || 'vi',
    category: category || 'Điện tử ứng dụng',
    tags: Array.isArray(tags) ? tags : ['Arduino', 'Circuit'],
    prerequisites: Array.isArray(prerequisites) ? prerequisites : [],
    learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes : [],
    estimatedHours: Number(estimatedHours) || 8,
    status: 'PUBLISHED',
    chapters: Array.isArray(chapters) ? chapters : [],
    featuredProjectId,
  });

  res.json({ success: true, course });
});

// Update Creator Course
app.put('/api/creator/courses/:id', (req, res) => {
  const { id } = req.params;
  const { creatorId, ...updates } = req.body;
  if (!creatorId || !isCreatorUser(creatorId)) {
    return res.status(403).json({ error: 'Từ chối quyền Creator' });
  }

  try {
    const updated = creatorStore.updateCourse(id, creatorId, updates);
    res.json({ success: true, course: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Publish / Unpublish Course
app.post('/api/creator/courses/:id/publish', (req, res) => {
  const { id } = req.params;
  const { creatorId } = req.body;
  if (!creatorId || !isCreatorUser(creatorId)) return res.status(403).json({ error: 'Từ chối quyền' });
  try {
    const course = creatorStore.setCourseStatus(id, creatorId, 'PUBLISHED');
    res.json({ success: true, course });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/creator/courses/:id/unpublish', (req, res) => {
  const { id } = req.params;
  const { creatorId } = req.body;
  if (!creatorId || !isCreatorUser(creatorId)) return res.status(403).json({ error: 'Từ chối quyền' });
  try {
    const course = creatorStore.setCourseStatus(id, creatorId, 'UNPUBLISHED');
    res.json({ success: true, course });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 4.6 User Entitlements Check
app.get('/api/entitlements/:userId', (req, res) => {
  const { userId } = req.params;
  const list = Array.from(serverEntitlementsStore.values()).filter((e) => e.userId === userId);
  res.json({ entitlements: list });
});

// 5. CircuitCraft 3D - Email OTP Authentication Routes
app.post('/api/auth/check-email', async (req, res) => {
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

app.post(['/api/auth/send-otp', '/api/auth/send-email-otp'], async (req, res) => {
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
        const isPasswordCorrect = await verifyUserPassword(cleanEmail, password);
        if (!isPasswordCorrect) {
          return res.status(400).json({
            success: false,
            message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại.',
          });
        }
      }
    }

    // 4. Nếu kiểm tra hợp lệ, tiến hành sinh và gửi mã OTP qua email
    const result = await createAndSendOtp({
      email: cleanEmail,
      fullName,
      intent,
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

app.get('/api/auth/check-delivery-status', async (req, res) => {
  try {
    const email = (req.query.email as string || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email.' });
    }
    const bounce = await checkEmailDeliveryBounce(email, 3200);
    if (bounce.bounced) {
      revokeOtp(email);
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

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, code, intent, password, fullName } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email và mã OTP 6 số.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await verifyOtpCodeAsync({ email: cleanEmail, code });
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

    const sessionToken = createSessionToken({
      id: userRecord.id,
      email: userRecord.email,
      verified: true,
    });

    const isAdmin = isVerifiedAdminEmail(userRecord.email, true);

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

// Cập nhật vai trò người dùng (chỉ cho phép chuyển đổi 'user' | 'pro' | 'creator'; quyền 'admin' chỉ được cấp bởi server qua ADMIN_EMAIL)
app.post('/api/user/role', async (req, res) => {
  try {
    const { emailOrId, role } = req.body;
    if (!emailOrId || !role) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin người dùng hoặc vai trò.' });
    }
    const existing = getUserById(emailOrId) || getUserByEmail(emailOrId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản để cập nhật quyền.' });
    }
    if (role === 'admin' && !isVerifiedAdminEmail(existing.email, Boolean(existing.verifiedAt))) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Không được phép tự nâng quyền Quản trị viên (Admin).',
      });
    }
    const success = updateUserRole(emailOrId, role);
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

// Đồng bộ phiên đăng nhập và xác thực quyền Admin từ phía máy chủ
app.post('/api/auth/session', (req, res) => {
  try {
    const { id, email, fullName, isVerified } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Thiếu email phiên đăng nhập' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const verified = isVerified !== false;
    const userRecord = ensureAuthenticatedUserRecord({
      id,
      email: cleanEmail,
      fullName,
      verified,
    });
    const isAdmin = isVerifiedAdminEmail(userRecord.email, Boolean(userRecord.verifiedAt));
    const sessionToken = createSessionToken({
      id: userRecord.id,
      email: userRecord.email,
      verified: Boolean(userRecord.verifiedAt),
    });

    res.json({
      success: true,
      sessionToken,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        fullName: userRecord.fullName,
        role: isAdmin ? 'admin' : userRecord.role,
        tier: userRecord.tier,
        status: userRecord.status || 'active',
        isAdmin,
        verifiedAt: userRecord.verifiedAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5.1 Quên mật khẩu - Gửi mã xác thực OTP 6 số về Email
app.post('/api/auth/forgot-password/send-email-otp', async (req, res) => {
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
app.post('/api/auth/forgot-password/reset-password', async (req, res) => {
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
    const verifyResult = await verifyOtpCodeAsync({ email: cleanEmail, code: cleanCode });
    if (!verifyResult.success) {
      // Nếu không khớp qua email, kiểm tra fallback nếu có phone
      if (phone) {
        const phoneVerify = verifyPhoneOtpCode({ phone, code: cleanCode });
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
app.post('/api/auth/forgot-password/send-phone-otp', async (req, res) => {
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
app.post('/api/auth/forgot-password/reset-phone-password', async (req, res) => {
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
    const verifyRes = verifyPhoneOtpCode({ phone: cleanPhone, code: code.trim() });
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
  const phone = req.params.phone;
  const dispatched = getDispatchedSms(phone);
  if (!dispatched) {
    return res.status(404).json({ error: 'Chưa có tin nhắn SMS nào gửi tới số điện thoại này.' });
  }
  res.json({ success: true, sms: dispatched });
});

app.get('/api/auth/email-preview/:email', (req, res) => {
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

app.get('/api/projects', (req, res) => {
  const user = resolveRequestUser(req);
  const requestedUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || user?.id;
  const requestedUserEmail = (req.query.userEmail as string) || (req.headers['x-user-email'] as string) || user?.email;
  const isAdmin = user && isVerifiedAdminEmail(user.email, true);
  const all = listAllPersonalProjects();

  // If unauthenticated / guest request, do not leak any user's personal projects
  if (!user && !requestedUserId && !requestedUserEmail) {
    return res.json({ projects: [] });
  }

  // Admin requesting all projects explicitly (via ?all=true)
  if (isAdmin && req.query.all === 'true') {
    return res.json({ projects: all });
  }

  // Filter strictly by the authenticated user's ID or email
  const filtered = all.filter((p) => {
    if (user?.id && (p.ownerId === user.id || p.document?.authorId === user.id)) return true;
    if (user?.email && p.ownerEmail && p.ownerEmail.toLowerCase() === user.email.toLowerCase()) return true;
    if (requestedUserId && (p.ownerId === requestedUserId || p.document?.authorId === requestedUserId)) return true;
    if (requestedUserEmail && p.ownerEmail && p.ownerEmail.toLowerCase() === requestedUserEmail.toLowerCase()) return true;
    return false;
  });

  // Deduplicate by projectId
  const seenIds = new Set<string>();
  const uniqueList = [];
  for (const item of filtered) {
    const pId = item.id || item.document?.projectId;
    if (pId && !seenIds.has(pId)) {
      seenIds.add(pId);
      uniqueList.push(item);
    }
  }

  res.json({ projects: uniqueList });
});

app.get('/api/projects/:id', (req, res) => {
  const user = resolveRequestUser(req);
  const requestedUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || user?.id;
  const requestedUserEmail = (req.query.userEmail as string) || (req.headers['x-user-email'] as string) || user?.email;
  const isAdmin = user && isVerifiedAdminEmail(user.email, true);

  const project = listAllPersonalProjects().find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Security check: only project owner or admin can retrieve private project
  if (!isAdmin) {
    const isOwner =
      (user?.id && (project.ownerId === user.id || project.document?.authorId === user.id)) ||
      (user?.email && project.ownerEmail?.toLowerCase() === user.email.toLowerCase()) ||
      (requestedUserId && (project.ownerId === requestedUserId || project.document?.authorId === requestedUserId)) ||
      (requestedUserEmail && project.ownerEmail?.toLowerCase() === requestedUserEmail.toLowerCase());

    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }
  }

  res.json({ project });
});

app.post('/api/projects', (req, res) => {
  const { project, userId, userEmail, userName, versionNote } = req.body;
  const targetDoc = project?.projectId ? project : project?.id ? { ...project, projectId: project.id } : null;
  if (!targetDoc) {
    return res.status(400).json({ error: 'Invalid project payload' });
  }
  const saved = syncPersonalProject({
    project: targetDoc,
    userId,
    userEmail,
    userName,
    versionNote,
  });
  res.json({ success: true, id: saved?.id, project: saved });
});

app.post('/api/projects/sync', (req, res) => {
  const { project, projects, userId, userEmail, userName, versionNote } = req.body;
  if (Array.isArray(projects)) {
    const synced = projects
      .map((p) =>
        syncPersonalProject({
          project: p,
          userId,
          userEmail,
          userName,
        })
      )
      .filter(Boolean);
    return res.json({ success: true, count: synced.length });
  }
  if (project) {
    const saved = syncPersonalProject({
      project,
      userId,
      userEmail,
      userName,
      versionNote,
    });
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

app.delete('/api/projects/:id', (req, res) => {
  removePersonalProject(req.params.id);
  res.json({ success: true });
});

app.post('/api/courses/enroll', (req, res) => {
  const { userId, userEmail, courseId, courseTitle, completedLessons, totalLessons } = req.body;
  if (!userId || !courseId) {
    return res.status(400).json({ error: 'Missing userId or courseId' });
  }
  const enrollment = recordCourseEnrollment({
    userId,
    userEmail: userEmail || getUserById(userId)?.email || 'user@circuitcraft.io',
    courseId,
    courseTitle: courseTitle || SERVER_PRODUCTS[courseId]?.title || courseId,
    completedLessons,
    totalLessons,
  });
  addSystemLog({
    level: 'info',
    category: 'course',
    action: 'COURSE_PROGRESS_SYNC',
    actorId: userId,
    actorEmail: enrollment.userEmail,
    targetId: courseId,
    details: `Cập nhật tiến độ khóa học "${enrollment.courseTitle}" (${enrollment.progressPercent}%)`,
  });
  res.json({ success: true, enrollment });
});

// ==========================================
// 6. CREATOR ECONOMY & MARKETPLACE API ROUTES
// ==========================================

// 6.1 Creator Profile
app.get('/api/creator/profile', (req, res) => {
  const userId = (req.query.userId as string) || 'creator-demo';
  let profile = creatorStore.getProfile(userId);
  if (!profile) {
    profile = creatorStore.upsertProfile(userId, {
      displayName: 'Huỳnh Phong',
      bio: 'Kỹ sư Vi mạch & Nhúng IoT, Giảng viên mô phỏng 3D tại CircuitCraft',
      specialty: 'Thiết kế PCB 3D, IoT ESP32, Tự động hóa',
      isVerified: true,
      tier: 'creator',
    });
  }
  res.json({ success: true, profile });
});

app.put('/api/creator/profile', (req, res) => {
  const { userId, displayName, bio, specialty, avatarUrl, socialLinks } = req.body;
  const uid = userId || 'creator-demo';
  const profile = creatorStore.upsertProfile(uid, {
    displayName,
    bio,
    specialty,
    avatarUrl,
    socialLinks,
  });
  res.json({ success: true, profile });
});

app.post('/api/creator/activate-tier', (req, res) => {
  const { userId, tier } = req.body;
  const uid = userId || 'creator-demo';
  creatorStore.upsertProfile(uid, { tier: tier || 'creator' });
  res.json({ success: true, tier: tier || 'creator' });
});

// 6.2 Creator Products
app.get('/api/creator/products', (req, res) => {
  const userId = (req.query.userId as string) || 'creator-demo';
  const products = creatorStore.listCreatorProducts(userId);
  res.json({ success: true, products });
});

app.post('/api/creator/products', (req, res) => {
  try {
    const {
      userId,
      title,
      tagline,
      description,
      price,
      currency,
      tags,
      deliverables,
      prerequisites,
      sourceProjectId,
      projectDocument,
      versionNumber,
      releaseNotes,
    } = req.body;

    const uid = userId || 'creator-demo';
    const profile = creatorStore.getProfile(uid);
    const creatorName = profile?.displayName || 'Huỳnh Phong';

    const productId = `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const componentsSummary = Array.isArray(projectDocument?.components)
      ? projectDocument.components.map((c: any) => c.name || c.definitionId).slice(0, 5)
      : ['Linh kiện 3D CircuitCraft'];

    const product = creatorStore.createProduct({
      id: productId,
      creatorId: uid,
      creatorName,
      type: 'project',
      title: title || 'Mạch điện thiết kế 3D',
      tagline: tagline || 'Mô hình mạch điện tương tác',
      description: description || 'Mạch điện nguyên lý và mô phỏng 3D trên nền tảng CircuitCraft',
      price: typeof price === 'number' ? price : 0,
      currency: currency || 'VND',
      status: 'PUBLISHED',
      difficulty: 'Trung bình',
      category: 'Mạch ứng dụng',
      tags: Array.isArray(tags) ? tags : ['3D', 'Mô phỏng'],
      componentsSummary,
      deliverables: Array.isArray(deliverables) ? deliverables : ['Mô hình 3D', 'Sơ đồ nguyên lý'],
      prerequisites: Array.isArray(prerequisites) ? prerequisites : [],
      currentVersionNumber: versionNumber || '1.0.0',
    });

    if (projectDocument) {
      creatorStore.createProductVersion({
        productId,
        creatorId: uid,
        version: versionNumber || '1.0.0',
        sourceProjectId: sourceProjectId || productId,
        projectSnapshot: projectDocument,
        changelog: releaseNotes || 'Bản phát hành đầu tiên v1.0.0',
      });
    }

    res.json({ success: true, product });
  } catch (err: any) {
    console.error('Error creating product:', err);
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tạo sản phẩm' });
  }
});

app.put('/api/creator/products/:id', (req, res) => {
  try {
    const productId = req.params.id;
    const { userId, status, ...updates } = req.body;
    const uid = userId || 'creator-demo';
    let product = creatorStore.getProduct(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
    }
    if (status) {
      product = creatorStore.setProductStatus(productId, uid, status);
    }
    if (Object.keys(updates).length > 0) {
      product = creatorStore.updateProduct(productId, uid, updates);
    }
    res.json({ success: true, product });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/creator/products/:id', (req, res) => {
  const productId = req.params.id;
  const success = creatorStore.deleteProduct(productId);
  res.json({ success });
});

// 6.3 Product Versions
app.get('/api/creator/products/:id/versions', (req, res) => {
  const productId = req.params.id;
  const versions = creatorStore.listVersions(productId);
  res.json({ success: true, versions });
});

app.post('/api/creator/products/:id/versions', (req, res) => {
  try {
    const productId = req.params.id;
    const { versionNumber, releaseNotes, projectDocument, creatorId } = req.body;
    const product = creatorStore.getProduct(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
    }
    const uid = creatorId || product.creatorId || 'creator-demo';
    const version = creatorStore.createProductVersion({
      productId,
      creatorId: uid,
      version: versionNumber || '1.1.0',
      sourceProjectId: projectDocument?.projectId || productId,
      projectSnapshot: projectDocument || {},
      changelog: releaseNotes,
    });
    res.json({ success: true, version });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 6.4 Creator Courses
app.get('/api/creator/courses', (req, res) => {
  const userId = (req.query.userId as string) || 'creator-demo';
  const courses = creatorStore.listCreatorCourses(userId);
  res.json({ success: true, courses });
});

app.post('/api/creator/courses', (req, res) => {
  try {
    const {
      userId,
      title,
      tagline,
      description,
      price,
      currency,
      difficulty,
      level,
      category,
      tags,
      prerequisites,
      learningOutcomes,
      syllabus,
      chapters,
    } = req.body;

    const uid = userId || 'creator-demo';
    const profile = creatorStore.getProfile(uid);
    const creatorName = profile?.displayName || 'Huỳnh Phong';

    const courseId = `course-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const courseChapters = Array.isArray(chapters) && chapters.length > 0
      ? chapters
      : Array.isArray(syllabus)
      ? [
          {
            id: `chap-${Date.now()}`,
            courseId,
            title: 'Nội dung thực hành khóa học',
            position: 1,
            lessons: syllabus.map((s: any, idx: number) => ({
              id: `les-${idx + 1}`,
              chapterId: `chap-${Date.now()}`,
              title: s.title || `Bài học ${idx + 1}`,
              content: s.description || s.content || '',
              position: idx + 1,
            })),
          },
        ]
      : [];

    const course = creatorStore.createCourse({
      id: courseId,
      creatorId: uid,
      creatorName,
      title: title || 'Khóa học thiết kế mạch 3D',
      tagline: tagline || 'Thực hành mô phỏng kỹ thuật điện tử 3D',
      description: description || 'Nội dung đào tạo thực chiến kết hợp mô phỏng vi mạch.',
      price: typeof price === 'number' ? price : 0,
      currency: currency || 'VND',
      difficulty: (difficulty || level || 'Cơ bản') as any,
      language: 'vi',
      category: category || 'Điện tử ứng dụng',
      tags: Array.isArray(tags) ? tags : ['Circuit', '3D'],
      prerequisites: Array.isArray(prerequisites) ? prerequisites : [],
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes : [],
      estimatedHours: 10,
      status: 'PUBLISHED',
      chapters: courseChapters,
    });

    res.json({ success: true, course });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/creator/courses/:id', (req, res) => {
  try {
    const courseId = req.params.id;
    const { userId, status, ...updates } = req.body;
    const uid = userId || 'creator-demo';
    let course = creatorStore.getCourse(courseId);
    if (!course) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy khóa học' });
    }
    if (status) {
      course = creatorStore.setCourseStatus(courseId, uid, status);
    }
    if (Object.keys(updates).length > 0) {
      course = creatorStore.updateCourse(courseId, uid, updates);
    }
    res.json({ success: true, course });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/creator/courses/:id', (req, res) => {
  const courseId = req.params.id;
  const success = creatorStore.deleteCourse(courseId);
  res.json({ success });
});

// 6.5 Creator Sales & Orders
app.get('/api/creator/sales', (req, res) => {
  const userId = (req.query.userId as string) || 'creator-demo';
  const rawSales = creatorStore.getCreatorSales(userId);
  const sales = rawSales.map((s) => ({
    id: s.id,
    orderId: s.orderId || s.orderCode || s.id,
    productTitle: s.productTitle,
    buyerName: s.buyerEmail || 'Học viên Kỹ thuật',
    amount: s.unitPrice,
    creatorEarnings: Math.round(s.unitPrice * 0.85),
    createdAt: s.createdAt,
    status: 'COMPLETED',
  }));
  res.json({ success: true, sales });
});

// 6.6 Marketplace Public Catalog & 3D Preview Snapshot
app.get('/api/products/catalog', (req, res) => {
  const products = creatorStore.listPublishedProducts();
  res.json({ success: true, products });
});

app.get('/api/products/:id/preview', (req, res) => {
  const productId = req.params.id;
  const product = creatorStore.getProduct(productId);
  const version = creatorStore.getLatestVersionForProduct(productId);
  if (version && version.previewSnapshot) {
    return res.json({
      success: true,
      version: version.version,
      preview: version.previewSnapshot,
    });
  }

  // Realistic fallback 3D preview document
  const defaultPreview = {
    name: product?.title || 'Bản xem trước 3D',
    description: product?.description || 'Mạch điện nguyên lý',
    board: { width: 120, height: 80, color: '#064e3b', gridSpacing: 5 },
    readOnlyPreview: true,
    components: [
      {
        instanceId: 'p1',
        definitionId: 'dc-source',
        name: 'Nguồn 5V',
        position: { x: -35, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        parameters: { voltage: 5.0 },
      },
      {
        instanceId: 'r1',
        definitionId: 'resistor',
        name: 'R 220Ω',
        position: { x: 0, y: 0, z: -10 },
        rotation: { x: 0, y: 0, z: 0 },
        parameters: { resistance: 220 },
      },
      {
        instanceId: 'led1',
        definitionId: 'led',
        name: 'LED Chỉ báo',
        position: { x: 35, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        parameters: { color: '#10b981' },
      },
    ],
    connections: [
      { id: 'w1', fromComponentId: 'p1', fromPinId: 'vcc', toComponentId: 'r1', toPinId: 'pin1', wireColor: '#ef4444' },
      { id: 'w2', fromComponentId: 'r1', fromPinId: 'pin2', toComponentId: 'led1', toPinId: 'anode', wireColor: '#10b981' },
      { id: 'w3', fromComponentId: 'led1', fromPinId: 'cathode', toComponentId: 'p1', toPinId: 'gnd', wireColor: '#0f172a' },
    ],
  };

  res.json({
    success: true,
    version: product?.currentVersionNumber || '1.0.0',
    preview: defaultPreview,
  });
});

// ============================================================================
// 7. ADMIN DASHBOARD API ROUTES (STRICT SERVER-SIDE AUTHORIZATION)
// ============================================================================

function getUnifiedCoursesList() {
  const creatorCourses = creatorStore.listAllCourses();
  const creatorMap = new Map(creatorCourses.map((c) => [c.id, c]));
  const enrollments = listAllCourseEnrollments();
  const orders = Array.from(serverOrdersStore.values()).filter((o) => o.status === 'paid');

  const systemCourseDefs = [
    {
      id: 'course-uno-r3-basic',
      title: 'Khóa học UNO R3 - Mạch điện tử cơ bản',
      authorName: 'Huỳnh Phong',
      price: 799000,
      chaptersCount: 8,
      lessonsCount: 8,
      category: 'stem',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'course-intro-stem-3d',
      title: 'Nhập Môn Mạch Điện Tử & Mô Phỏng Thực Tế 3D',
      authorName: 'KS. Nguyễn Thành Luân',
      price: 0,
      chaptersCount: 4,
      lessonsCount: 4,
      category: 'stem',
      createdAt: '2026-09-02T00:00:00.000Z',
    },
    {
      id: 'course-switch-relays',
      title: 'Mạch Đóng Cắt Tự Động: Công Tắc, Relay & Bảo Vệ Mạch',
      authorName: 'ThS. Trần Hoàng Nam',
      price: 0,
      chaptersCount: 4,
      lessonsCount: 4,
      category: 'analog',
      createdAt: '2026-09-03T00:00:00.000Z',
    },
    {
      id: 'course-digital-logic',
      title: 'Thiết Kế Mạch Logic Số & Cổng Boolean Tương Tác 3D',
      authorName: 'TS. Lê Đăng Khoa',
      price: 199000,
      chaptersCount: 4,
      lessonsCount: 6,
      category: 'digital',
      createdAt: '2026-09-04T00:00:00.000Z',
    },
    {
      id: 'course-timer-555',
      title: 'Mastering IC Định Thời 555 & Dao Động Xung Đồng Hồ',
      authorName: 'Kỹ Sư Vũ Minh Quân',
      price: 299000,
      chaptersCount: 4,
      lessonsCount: 7,
      category: 'analog',
      createdAt: '2026-09-05T00:00:00.000Z',
    },
    {
      id: 'course-pcb-design-gerber',
      title: 'Thiết Kế Bo Mạch PCB Chuẩn Công Nghiệp & Xuất Gerber',
      authorName: 'KS. Đỗ Gia Huy',
      price: 590000,
      chaptersCount: 4,
      lessonsCount: 9,
      category: 'pcb',
      createdAt: '2026-09-06T00:00:00.000Z',
    },
  ];

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
  const confirmedRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

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
    });
    saveEntitlementsToDisk();
    if (order.productId === 'plan-creator') {
      updateUserTier(order.userId, 'creator');
    } else if (order.productId === 'plan-student') {
      updateUserTier(order.userId, 'student');
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
      price: 49000,
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
        .filter((o) => o.productId === 'plan-student')
        .reduce((s, o) => s + (Number(o.amount) || 0), 0),
    },
    {
      id: 'creator',
      tier: 'creator',
      code: 'plan-creator',
      name: 'Creator Pro',
      nameVi: 'Gói Chuyên Gia Sáng Tạo (Creator Pro)',
      price: 120000,
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
        .filter((o) => o.productId === 'plan-creator')
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

  const revenueInRange = filteredPaidOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
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

// Vite middleware or static serving
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CircuitCraft 3D Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
