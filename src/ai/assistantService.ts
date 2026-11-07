import { ProjectDocument } from '../domain/project/types';
import { SimulationResult } from '../domain/simulation/types';
import { AIChatMessage, AIProposal } from './types';
import { buildCircuitContext } from './circuitContext';

export interface PracticeLabAIContext {
  courseTitle: string;
  lessonTitle: string;
  shortDescription?: string;
  practiceSummary?: string;
  targetProject?: ProjectDocument;
  practiceStages?: any[];
}

/** Requests that ask Minibot to build / add circuitry (as opposed to questions). */
const DESIGN_INTENT = /(thêm|tạo|đề xuất|thiết kế|lắp|mạch mẫu|\badd\b|\bcreate\b|\bbuild\b|\bdesign\b|\bpropose\b)/i;
const QUESTION_INTENT = /(tại sao|vì sao|sao lại|không sáng|lỗi gì|kiểm tra|\bwhy\b|\bcheck\b)/i;

export function isDesignRequest(prompt: string): boolean {
  return DESIGN_INTENT.test(prompt) && !QUESTION_INTENT.test(prompt);
}

export class AssistantService {
  /**
   * Supports both calling conventions:
   * 1) askQuestion(text, history, { document, selectedComponentId, validationIssues, simulationResult, lessonGoal, practiceContext, locale })
   * 2) askQuestion(prompt, project, simResult, selectedObjectId, practiceContext)
   */
  public async askQuestion(
    prompt: string,
    secondArg: any,
    thirdArg?: any,
    fourthArg?: any,
    fifthArg?: PracticeLabAIContext | null
  ): Promise<AIChatMessage & { text: string }> {
    let project: ProjectDocument;
    let simResult: SimulationResult | null = null;
    let issues: any[] = [];
    let selectedObjectId: string | null = null;
    let practiceContext: PracticeLabAIContext | null = null;
    let history: Array<{ role: string; content: string }> = [];
    let locale: string = 'vi';

    if (Array.isArray(secondArg) && thirdArg && typeof thirdArg === 'object') {
      // Convention 1 (from App.tsx)
      history = secondArg;
      project = thirdArg.document;
      selectedObjectId = thirdArg.selectedComponentId || null;
      issues = thirdArg.validationIssues || [];
      simResult = thirdArg.simulationResult || null;
      practiceContext = thirdArg.practiceContext || null;
      locale = thirdArg.locale || 'vi';
    } else {
      // Convention 2
      project = secondArg as ProjectDocument;
      simResult = (thirdArg as SimulationResult) || null;
      selectedObjectId = (fourthArg as string) || null;
      practiceContext = fifthArg || null;
    }

    const context = buildCircuitContext({
      project,
      issues,
      simulation: simResult,
      selectedComponentId: selectedObjectId,
      practiceContext,
      locale,
    });

    // 1) Design requests -> structured proposal (validated server-side and again before preview)
    if (isDesignRequest(prompt) && !practiceContext) {
      try {
        const res = await fetch('/api/ai/propose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requirement: prompt, baseRevision: project?.revision ?? 0, context }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.proposal) {
          const text =
            `${data.proposal.explanation || 'Minibot đã chuẩn bị một đề xuất mạch.'}\n\n` +
            'Hãy xem trước danh sách linh kiện / dây nối và nhấn **"Áp dụng đề xuất"** nếu đồng ý. Bạn có thể hoàn tác (Undo) toàn bộ đề xuất bằng một lần nhấn.';
          return { id: `msg_${Date.now()}`, role: 'assistant', content: text, text, proposal: data.proposal, timestamp: new Date().toISOString() };
        }
        if (res.status === 422 || res.status === 502) {
          const detail = Array.isArray(data.errors) && data.errors.length ? `\n- ${data.errors.slice(0, 5).join('\n- ')}` : '';
          const text = `Đề xuất do AI tạo không vượt qua bước kiểm tra an toàn nên đã bị loại bỏ (mạch của bạn không bị thay đổi).${detail}\nBạn có thể thử mô tả yêu cầu cụ thể hơn.`;
          return { id: `msg_${Date.now()}`, role: 'assistant', content: text, text, timestamp: new Date().toISOString() };
        }
        if (res.status !== 503) {
          // Other server failure: fall through to the template proposal below
        }
      } catch {
        // offline: fall through to the template proposal
      }
      const fallback = this.templateProposal(project);
      return { ...fallback, text: fallback.content };
    }

    // 2) Conversational answer with full circuit context
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          history: history
            .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
            .slice(-12)
            .map((h) => ({ role: h.role, content: h.content })),
          context,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const replyText = typeof data.reply === 'string' && data.reply.trim() ? data.reply : null;
        if (replyText) {
          return {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: replyText,
            text: replyText,
            timestamp: new Date().toISOString(),
          };
        }
      } else if (response.status === 429) {
        const busy = locale === 'en' ? 'You are sending messages too quickly. Please wait a few seconds.' : 'Bạn đang gửi câu hỏi hơi nhanh. Đợi vài giây rồi hỏi lại nhé.';
        return { id: `msg_${Date.now()}`, role: 'assistant', content: busy, text: busy, timestamp: new Date().toISOString() };
      }
    } catch {
      // Offline: answered below
    }

    // No answer from the AI (offline, busy, slow): say so, never pretend with a canned text
    const notice =
      locale === 'en'
        ? 'Minibot could not reach the AI model this time (offline, busy or slow). Please send your question again.'
        : 'Minibot chưa kết nối được tới mô hình AI lần này (mất mạng, đang bận hoặc phản hồi chậm). Bạn gửi lại câu hỏi giúp mình nhé.';
    return { id: `msg_${Date.now()}`, role: 'assistant', content: notice, text: notice, timestamp: new Date().toISOString() };
  }

  /**
   * Deterministic template (NOT generated by an AI model): a safe 5 V LED branch using the
   * canonical component schema. Clearly labelled as a template in the chat.
   */
  private templateProposal(project: ProjectDocument): AIChatMessage {
    const stamp = Date.now().toString(36);
    const baseX = (project?.components?.length || 0) > 0 ? 40 : 0;
    const batId = `tpl-src-${stamp}`;
    const resId = `tpl-r-${stamp}`;
    const ledId = `tpl-led-${stamp}`;
    const proposal: AIProposal & { source: 'template' } = {
      proposalId: `tpl_${stamp}`,
      source: 'template',
      explanation:
        'Đề xuất mẫu (không dùng mô hình AI): một nhánh mạch an toàn gồm Nguồn DC 5V, Điện trở hạn dòng 220Ω và Đèn LED xanh lá được nối khép kín.',
      baseRevision: project?.revision ?? 0,
      layoutDescription: 'Bố trí thẳng hàng theo trục X, cách nhau 25 mm.',
      componentsToAdd: [
        { instanceId: batId, definitionId: 'dc-source', name: 'Nguồn 5V', position: { x: baseX - 25, y: 0, z: 20 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { voltage: 5 } },
        { instanceId: resId, definitionId: 'resistor', name: 'R 220Ω', position: { x: baseX, y: 0, z: 20 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { resistance: 220 } },
        { instanceId: ledId, definitionId: 'led', name: 'LED Xanh', position: { x: baseX + 25, y: 0, z: 20 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { color: 'green' } },
      ],
      connectionsToAdd: [
        { id: `tpl-w1-${stamp}`, fromComponentId: batId, fromPinId: 'vcc', toComponentId: resId, toPinId: 'pin1', wireColor: '#ef4444' },
        { id: `tpl-w2-${stamp}`, fromComponentId: resId, fromPinId: 'pin2', toComponentId: ledId, toPinId: 'anode', wireColor: '#eab308' },
        { id: `tpl-w3-${stamp}`, fromComponentId: ledId, fromPinId: 'cathode', toComponentId: batId, toPinId: 'gnd', wireColor: '#3b82f6' },
      ],
    };
    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content:
        'Mô hình AI hiện không khả dụng, nên tôi đưa ra **đề xuất mẫu** (không phải do AI tạo): nhánh LED hoàn chỉnh kèm điện trở bảo vệ 220Ω. Bạn có thể xem chi tiết và nhấn **"Áp dụng đề xuất"** để đưa vào cảnh 3D.',
      proposal,
      timestamp: new Date().toISOString(),
    };
  }

  private localSmartFallback(
    prompt: string,
    project: ProjectDocument,
    simResult: SimulationResult | null,
    issues: any[],
    practiceContext?: PracticeLabAIContext | null
  ): AIChatMessage {
    const q = prompt.toLowerCase();

    if (practiceContext) {
      const targetComps = practiceContext.targetProject?.components || [];
      const targetConns = practiceContext.targetProject?.connections || [];
      const studentComps = project?.components || [];
      const studentConns = project?.connections || [];

      const stagesText = (practiceContext.practiceStages || [])
        .map(
          (st: any) =>
            `**${st.title}**:\n${(st.steps || []).map((s: string) => `  - ${s}`).join('\n')}`
        )
        .join('\n\n');

      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content:
          `Chào bạn! Tôi đang đồng hành cùng bạn trong bài thực hành **"${practiceContext.lessonTitle}"** thuộc khóa học **"${practiceContext.courseTitle}"**.\n\n` +
          `📌 **Mục tiêu bài thực hành:** ${practiceContext.shortDescription || practiceContext.practiceSummary || 'Hoàn thiện lắp ráp mạch 3D theo 3 giai đoạn chuẩn.'}\n\n` +
          `📊 **Tiến độ trên bàn làm việc của bạn hiện tại:**\n` +
          `- Thiết bị đã đặt: **${studentComps.length}/${targetComps.length}** linh kiện\n` +
          `- Dây dẫn đã nối: **${studentConns.length}/${targetConns.length}** kết nối\n\n` +
          `🧭 **Hướng dẫn 3 giai đoạn chuẩn của bài thực hành này:**\n${stagesText || 'Xem chi tiết trong thanh Hướng dẫn thực hành ở phía dưới màn hình.'}`,
        timestamp: new Date().toISOString(),
      };
    }

    // Check if user asks about errors or why circuit isn't working
    if (
      q.includes('lỗi') ||
      q.includes('sao') ||
      q.includes('không sáng') ||
      q.includes('kiểm tra')
    ) {
      if (!issues || issues.length === 0) {
        return {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `Mạch hiện tại gồm ${project?.components?.length || 0} linh kiện và ${project?.connections?.length || 0} dây nối. Không phát hiện lỗi quy tắc thiết kế (DRC).${simResult ? ` Kết quả mô phỏng: ${simResult.summary}` : ' Hãy nhấn nút **Mô phỏng** trên thanh công cụ để xem dòng điện chạy!'}`,
          timestamp: new Date().toISOString(),
        };
      } else {
        const list = issues
          .map(
            (i: any, idx: number) =>
              `${idx + 1}. **[${i.severity?.toUpperCase() || 'INFO'}]** ${i.message} ${
                i.suggestion ? `*(Gợi ý: ${i.suggestion})*` : ''
              }`
          )
          .join('\n');
        return {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `Tôi phát hiện **${issues.length} vấn đề** trong mạch của bạn:\n\n${list}`,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: `Tôi đang quan sát mạch **"${project?.name || 'Dự án 3D'}"** (${project?.components?.length || 0} linh kiện, ${project?.connections?.length || 0} kết nối).\n\nBạn có thể hỏi tôi:\n- *"Kiểm tra lỗi mạch hiện tại"*\n- *"Tại sao đèn LED không sáng?"*\n- *"Đề xuất thêm một nhánh mạch LED mẫu"*`,
      timestamp: new Date().toISOString(),
    };
  }
}

export const assistantService = new AssistantService();
