import { ProjectDocument, ComponentInstance, Connection } from '../domain/project/types';
import { ValidationIssue } from '../domain/validation/types';
import { AIProposal, AIChatMessage } from './types';
import { COMPONENT_DEFINITION_MAP } from '../domain/components/definitions';

export interface AssistantQueryContext {
  document: ProjectDocument;
  selectedComponentId: string | null;
  validationIssues: ValidationIssue[];
  lessonGoal?: string;
  locale?: 'vi' | 'en';
}

export class AssistantService {
  /**
   * Send question to AI Assistant
   */
  async askQuestion(
    prompt: string,
    history: AIChatMessage[],
    context: AssistantQueryContext
  ): Promise<{ text: string; proposal?: AIProposal }> {
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          history: history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
          context: {
            locale: context.locale || 'vi',
            revision: context.document.revision,
            components: context.document.components.map((c) => ({
              id: c.instanceId,
              name: c.name,
              type: c.definitionId,
              params: c.parameters,
            })),
            connectionsCount: context.document.connections.length,
            selectedComponentId: context.selectedComponentId,
            issues: context.validationIssues.map((i) => i.message),
            lessonGoal: context.lessonGoal,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.proposal) {
          this.validateProposal(data.proposal, context.document);
        }
        return {
          text: data.reply || data.text,
          proposal: data.proposal,
        };
      }
    } catch (e) {
      console.warn('API server call failed, using intelligent rule-based AI fallback:', e);
    }

    // High quality local AI reasoning fallback
    return this.generateFallbackResponse(prompt, context);
  }

  /**
   * Request structured circuit proposal from AI
   */
  async generateCircuitProposal(
    userRequirement: string,
    document: ProjectDocument
  ): Promise<AIProposal> {
    try {
      const res = await fetch('/api/ai/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement: userRequirement,
          baseRevision: document.revision,
          currentComponentsCount: document.components.length,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.proposal) {
          this.validateProposal(data.proposal, document);
          return data.proposal;
        }
      }
    } catch (e) {
      console.warn('Server proposal call failed, falling back to local generator:', e);
    }

    return this.generateFallbackProposal(userRequirement, document);
  }

  /**
   * Strict validation of AI Proposal against component whitelist and board boundaries
   */
  private validateProposal(proposal: AIProposal, doc: ProjectDocument): void {
    if (!proposal || !Array.isArray(proposal.componentsToAdd) || !Array.isArray(proposal.connectionsToAdd)) {
      throw new Error('AI Proposal không đúng định dạng schema.');
    }

    // Whitelist check
    for (const comp of proposal.componentsToAdd) {
      if (!COMPONENT_DEFINITION_MAP.has(comp.definitionId)) {
        throw new Error(`Linh kiện ${comp.definitionId} không nằm trong danh mục hỗ trợ của CircuitCraft 3D.`);
      }
    }

    // Ensure positions are within board bounds
    const halfW = doc.board.width / 2 - 4;
    const halfD = doc.board.depth / 2 - 4;
    for (const comp of proposal.componentsToAdd) {
      comp.position.x = Math.max(-halfW, Math.min(halfW, comp.position.x));
      comp.position.z = Math.max(-halfD, Math.min(halfD, comp.position.z));
      comp.position.y = 0;
    }
  }

  /**
   * Intelligent domain-aware fallback response in Vietnamese or English
   */
  private generateFallbackResponse(
    prompt: string,
    ctx: AssistantQueryContext
  ): { text: string; proposal?: AIProposal } {
    const p = prompt.toLowerCase();
    const isEn = ctx.locale === 'en';

    if (p.includes('sai ở đâu') || p.includes('lỗi gì') || p.includes('kiểm tra') || p.includes('error') || p.includes('wrong') || p.includes('check')) {
      if (ctx.validationIssues.length === 0) {
        return {
          text: isEn
            ? 'Great news! Your circuit has no detected design rule violations. You can click "Simulate" to observe circuit behavior!'
            : 'Tin vui! Mạch điện hiện tại của bạn không phát hiện bất kỳ lỗi thiết kế nào theo quy tắc kiểm tra tiêu chuẩn. Bạn có thể nhấn nút "Mô phỏng hành vi" để quan sát mạch hoạt động!',
        };
      }
      const issueList = ctx.validationIssues
        .map((iss, i) => `${i + 1}. **${iss.message}** (${isEn ? 'Hint' : 'Gợi ý'}: ${iss.suggestion || (isEn ? 'Check wire connections' : 'Kiểm tra lại kết nối')})`)
        .join('\n');
      return {
        text: isEn
          ? `Minibot analyzed your circuit and found the following points to note:\n\n${issueList}\n\nPlease address these to ensure safe and functional operation!`
          : `Minibot đã phân tích mạch của bạn và phát hiện các điểm cần chú ý:\n\n${issueList}\n\nHãy sửa các điểm trên để mạch có thể hoạt động an toàn nhé!`,
      };
    }

    if (p.includes('led') && (p.includes('chiều') || p.includes('cực') || p.includes('chân') || p.includes('polarity') || p.includes('anode') || p.includes('cathode'))) {
      return {
        text: isEn
          ? 'An LED is a semiconductor diode that permits current in only one forward direction:\n- **Anode (+) pin**: The longer lead, must connect towards the positive supply rail (+VCC).\n- **Cathode (-) pin**: The shorter lead or flat notch on rim, must connect to Ground (GND).\n*Note*: Always include a series resistor (220Ω - 330Ω) to limit forward current below 20mA and prevent burnout.'
          : 'Đèn LED là linh kiện bán dẫn chỉ cho dòng điện chạy qua theo một chiều duy nhất (phân cực thuận):\n- **Chân Anode (+)**: Chân dài hơn, cần được nối về phía cực dương (+VCC).\n- **Chân Cathode (-)**: Chân ngắn hơn hoặc vát cạnh thân LED, cần được nối về mass (GND).\n*Lưu ý*: Luôn mắc nối tiếp điện trở (220Ω - 330Ω) để tránh dòng điện vượt quá 20mA làm cháy LED.',
      };
    }

    if (p.includes('tạo mạch') || p.includes('làm mạch') || p.includes('đề xuất') || p.includes('create') || p.includes('circuit') || p.includes('propose')) {
      const proposal = this.generateFallbackProposal(prompt, ctx.document);
      return {
        text: isEn
          ? `I have synthesized a circuit proposal for your request: "${prompt}".\nIncludes: ${proposal.layoutDescription}.\n\nYou can click **View Proposal** below to inspect it before applying to your 3D board.`
          : `Tôi đã lập một đề xuất thiết kế mạch theo yêu cầu: "${prompt}".\nBao gồm: ${proposal.layoutDescription}.\n\nBạn có thể nhấn nút **Xem đề xuất** bên dưới để kiểm tra trước khi áp dụng vào mạch.`,
        proposal,
      };
    }

    return {
      text: isEn
        ? `Hello! I am Minibot - your 3D electronic laboratory assistant. Your board currently has ${ctx.document.components.length} components and ${ctx.document.connections.length} connections. Ask me about pinouts, Ohm's law, or ask me to propose a circuit design!`
        : `Xin chào! Tôi là Minibot - Trợ lý phòng thí nghiệm điện tử 3D của bạn. Hiện tại mạch đang có ${ctx.document.components.length} linh kiện và ${ctx.document.connections.length} đường dây nối. Bạn có thể hỏi tôi về cách nối chân, nguyên lý hoạt động hoặc yêu cầu tôi tạo một mạch điện mẫu tự động.`,
    };
  }

  private generateFallbackProposal(requirement: string, doc: ProjectDocument): AIProposal {
    const isSwitchReq = requirement.toLowerCase().includes('công tắc') || requirement.toLowerCase().includes('switch');
    const baseRev = doc.revision;

    if (isSwitchReq) {
      const compPwr: ComponentInstance = {
        instanceId: `pwr-${Date.now().toString(36)}`,
        definitionId: 'dc-source',
        name: 'Nguồn 5V',
        position: { x: -45, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        parameters: { voltage: 5.0 },
      };

      const compSw: ComponentInstance = {
        instanceId: `sw-${Date.now().toString(36)}`,
        definitionId: 'switch',
        name: 'Công tắc SW1',
        position: { x: -15, y: 0, z: -15 },
        rotation: { x: 0, y: 0, z: 0 },
        parameters: { type: 'slide' },
        state: { open: false },
      };

      const compRes: ComponentInstance = {
        instanceId: `res-${Date.now().toString(36)}`,
        definitionId: 'resistor',
        name: 'Điện trở R1 (220Ω)',
        position: { x: 15, y: 0, z: -15 },
        rotation: { x: 0, y: 0, z: 0 },
        parameters: { resistance: 220 },
      };

      const compLed: ComponentInstance = {
        instanceId: `led-${Date.now().toString(36)}`,
        definitionId: 'led',
        name: 'LED Đỏ',
        position: { x: 45, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        parameters: { color: 'red' },
      };

      const conns: Connection[] = [
        {
          id: `conn-ai-1-${Date.now()}`,
          fromComponentId: compPwr.instanceId,
          fromPinId: 'vcc',
          toComponentId: compSw.instanceId,
          toPinId: 'pin1',
          wireColor: '#ef4444',
        },
        {
          id: `conn-ai-2-${Date.now()}`,
          fromComponentId: compSw.instanceId,
          fromPinId: 'pin2',
          toComponentId: compRes.instanceId,
          toPinId: 'pin1',
          wireColor: '#f59e0b',
        },
        {
          id: `conn-ai-3-${Date.now()}`,
          fromComponentId: compRes.instanceId,
          fromPinId: 'pin2',
          toComponentId: compLed.instanceId,
          toPinId: 'anode',
          wireColor: '#10b981',
        },
        {
          id: `conn-ai-4-${Date.now()}`,
          fromComponentId: compLed.instanceId,
          fromPinId: 'cathode',
          toComponentId: compPwr.instanceId,
          toPinId: 'gnd',
          wireColor: '#0f172a',
        },
      ];

      return {
        proposalId: `prop-${Date.now()}`,
        baseRevision: baseRev,
        explanation: 'Mạch điều khiển đèn LED nối tiếp bằng công tắc SPST: Nguồn 5V -> Công tắc -> Điện trở 220Ω -> LED -> GND.',
        componentsToAdd: [compPwr, compSw, compRes, compLed],
        connectionsToAdd: conns,
        layoutDescription: '4 linh kiện bố trí nối tiếp tạo thành chu trình khép kín an toàn.',
        suggestedActions: ['Bật mô phỏng và click vào công tắc để bật/tắt đèn.'],
      };
    }

    // Standard LED circuit
    const compPwr: ComponentInstance = {
      instanceId: `pwr-${Date.now().toString(36)}`,
      definitionId: 'dc-source',
      name: 'Nguồn DC 5V',
      position: { x: -35, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: { voltage: 5.0 },
    };

    const compRes: ComponentInstance = {
      instanceId: `res-${Date.now().toString(36)}`,
      definitionId: 'resistor',
      name: 'R1 (220Ω)',
      position: { x: 0, y: 0, z: -15 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: { resistance: 220 },
    };

    const compLed: ComponentInstance = {
      instanceId: `led-${Date.now().toString(36)}`,
      definitionId: 'led',
      name: 'LED Xanh',
      position: { x: 35, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: { color: 'green' },
    };

    const conns: Connection[] = [
      {
        id: `c-ai-1-${Date.now()}`,
        fromComponentId: compPwr.instanceId,
        fromPinId: 'vcc',
        toComponentId: compRes.instanceId,
        toPinId: 'pin1',
        wireColor: '#ef4444',
      },
      {
        id: `c-ai-2-${Date.now()}`,
        fromComponentId: compRes.instanceId,
        fromPinId: 'pin2',
        toComponentId: compLed.instanceId,
        toPinId: 'anode',
        wireColor: '#10b981',
      },
      {
        id: `c-ai-3-${Date.now()}`,
        fromComponentId: compLed.instanceId,
        fromPinId: 'cathode',
        toComponentId: compPwr.instanceId,
        toPinId: 'gnd',
        wireColor: '#0f172a',
      },
    ];

    return {
      proposalId: `prop-${Date.now()}`,
      baseRevision: baseRev,
      explanation: 'Mạch thắp sáng LED tiêu chuẩn với Nguồn 5V, Điện trở bảo vệ 220Ω và Đèn LED xanh.',
      componentsToAdd: [compPwr, compRes, compLed],
      connectionsToAdd: conns,
      layoutDescription: '3 linh kiện được định tuyến dây hợp lý và cân đối trên bo mạch.',
    };
  }
}

export const assistantService = new AssistantService();
