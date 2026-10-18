import { ProjectDocument } from '../domain/project/types';
import { SimulationResult } from '../domain/simulation/types';
import { AIChatMessage, AIProposal } from './types';

export interface PracticeLabAIContext {
  courseTitle: string;
  lessonTitle: string;
  shortDescription?: string;
  practiceSummary?: string;
  targetProject?: ProjectDocument;
  practiceStages?: any[];
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

    if (Array.isArray(secondArg) && thirdArg && typeof thirdArg === 'object') {
      // Convention 1 (from App.tsx)
      project = thirdArg.document;
      selectedObjectId = thirdArg.selectedComponentId || null;
      issues = thirdArg.validationIssues || [];
      simResult = thirdArg.simulationResult || null;
      practiceContext = thirdArg.practiceContext || null;
    } else {
      // Convention 2
      project = secondArg as ProjectDocument;
      simResult = (thirdArg as SimulationResult) || null;
      selectedObjectId = (fourthArg as string) || null;
      practiceContext = fifthArg || null;
    }

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          project,
          simResult,
          issues,
          selectedObjectId,
          practiceContext: practiceContext || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const replyText = data.reply || data.text || 'Tôi đã phân tích mạch của bạn.';
        return {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: replyText,
          text: replyText,
          proposal: data.proposal,
          timestamp: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback to local deterministic rule engine if offline or backend unavailable
    }

    const fallback = this.localSmartFallback(prompt, project, simResult, issues, practiceContext);
    return {
      ...fallback,
      text: fallback.content,
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

    // Check if user wants to build or add an LED circuit
    if (
      q.includes('thêm') ||
      q.includes('tạo') ||
      q.includes('đề xuất') ||
      q.includes('mạch mẫu') ||
      q.includes('led')
    ) {
      const baseX = (project?.components?.length || 0) > 0 ? 4 : 0;
      const proposal: AIProposal = {
        proposalId: `prop_${Date.now()}`,
        explanation:
          'Đề xuất thêm một nhánh mạch mẫu an toàn gồm: Nguồn DC 5V, Điện trở hạn dòng 220Ω và Đèn LED Xanh lá được nối khép kín.',
        baseRevision: Date.now(),
        layoutDescription: 'Bố trí thẳng hàng ngang cách mạch hiện tại 4 đơn vị.',
        componentsToAdd: [
          {
            instanceId: `ai_bat_${Date.now()}`,
            definitionId: 'dc_source',
            name: 'Nguồn AI 5V',
            position: { x: baseX - 3, y: 0, z: 2 },
            rotation: { x: 0, y: 0, z: 0 },
            parameters: { voltage: 5 },
          },
          {
            instanceId: `ai_res_${Date.now()}`,
            definitionId: 'resistor',
            name: 'R_AI 220Ω',
            position: { x: baseX, y: 0, z: 2 },
            rotation: { x: 0, y: 0, z: 0 },
            parameters: { resistance: 220 },
          },
          {
            instanceId: `ai_led_${Date.now()}`,
            definitionId: 'led',
            name: 'LED AI Xanh',
            position: { x: baseX + 3, y: 0, z: 2 },
            rotation: { x: 0, y: 0, z: 0 },
            parameters: { color: 'green', forwardVoltage: 2.1 },
          },
        ],
        connectionsToAdd: [],
      };
      const batId = proposal.componentsToAdd[0].instanceId;
      const resId = proposal.componentsToAdd[1].instanceId;
      const ledId = proposal.componentsToAdd[2].instanceId;
      proposal.connectionsToAdd = [
        {
          id: `ai_w1_${Date.now()}`,
          fromComponentId: batId,
          fromPinId: 'vcc',
          toComponentId: resId,
          toPinId: 'p1',
          wireColor: '#ef4444',
        },
        {
          id: `ai_w2_${Date.now()}`,
          fromComponentId: resId,
          fromPinId: 'p2',
          toComponentId: ledId,
          toPinId: 'anode',
          wireColor: '#eab308',
        },
        {
          id: `ai_w3_${Date.now()}`,
          fromComponentId: ledId,
          fromPinId: 'cathode',
          toComponentId: batId,
          toPinId: 'gnd',
          wireColor: '#3b82f6',
        },
      ];

      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content:
          'Tôi đã chuẩn bị một đề xuất thêm mạch nhánh LED hoàn chỉnh (kèm điện trở bảo vệ 220Ω). Bạn có thể xem chi tiết và nhấn **"Áp dụng đề xuất"** bên dưới để đưa vào cảnh 3D.',
        proposal,
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
          content: `Mạch hiện tại gồm ${project?.components?.length || 0} linh kiện và ${project?.connections?.length || 0} dây nối. Không phát hiện lỗi quy tắc thiết kế (DRC). Hãy nhấn nút **Mô phỏng** trên thanh công cụ để xem dòng điện chạy!`,
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
