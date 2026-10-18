import JSZip from 'jszip';
import { CourseSlide, PracticeStage, PracticeStageChecklistItem } from './types';
import { ProjectDocument } from '../project/types';
import { COMPONENT_DEFINITION_MAP } from '../components/definitions';

/**
 * Friendly Vietnamese component names for 3D circuit components
 */
export function getFriendlyComponentName(definitionId: string, fallbackName?: string): string {
  const def = COMPONENT_DEFINITION_MAP.get(definitionId);
  if (def?.name) return def.name;
  const map: Record<string, string> = {
    'dc-source': 'Nguồn DC (5V/9V)',
    resistor: 'Điện trở hạn dòng',
    led: 'Đèn LED phát quang',
    'switch-spst': 'Công tắc gạt SPST',
    switch: 'Công tắc đóng ngắt',
    potentiometer: 'Biến trở (Chiết áp)',
    ldr: 'Quang trở (Cảm biến ánh sáng LDR)',
    buzzer: 'Còi báo động Buzzer',
    lm35: 'Cảm biến nhiệt độ LM35',
    relay: 'Rơ-le cách ly (Relay)',
    ne555: 'IC định thời NE555',
    capacitor: 'Tụ điện',
    connector: 'Cầu đấu dây (Terminal)',
  };
  return map[definitionId] || fallbackName || definitionId;
}

/**
 * Parse a real .pptx PowerPoint file into structured CourseSlide[]
 * Extracts text paragraphs, titles, bullets, speaker notes, and embedded slide images.
 */
export async function parsePptxFileToSlides(file: File): Promise<CourseSlide[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Find all ppt/slides/slideN.xml files
    const slidePaths: Array<{ num: number; path: string }> = [];
    zip.forEach((relativePath) => {
      const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
      if (match) {
        slidePaths.push({
          num: parseInt(match[1], 10),
          path: relativePath,
        });
      }
    });

    slidePaths.sort((a, b) => a.num - b.num);

    if (slidePaths.length === 0) {
      throw new Error('Không tìm thấy trang slide nào trong tệp .pptx này.');
    }

    const parser = new DOMParser();
    const slides: CourseSlide[] = [];

    for (let idx = 0; idx < slidePaths.length; idx++) {
      const { num, path: slidePath } = slidePaths[idx];
      const slideNumber = idx + 1;
      const xmlStr = await zip.file(slidePath)?.async('string');
      if (!xmlStr) continue;

      const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');

      // Extract text per shape (<p:sp>)
      const shapes = Array.from(xmlDoc.getElementsByTagNameNS('*', 'sp'));
      let slideTitle = '';
      const bullets: string[] = [];

      for (const sp of shapes) {
        // Check if this shape is a title placeholder
        const phs = Array.from(sp.getElementsByTagNameNS('*', 'ph'));
        const isTitleShape = phs.some((ph) => {
          const t = (ph.getAttribute('type') || '').toLowerCase();
          return t === 'title' || t === 'ctrtitle';
        });

        // Extract paragraphs (<a:p>) inside this shape
        const paragraphs = Array.from(sp.getElementsByTagNameNS('*', 'p'));
        const shapeLines: string[] = [];

        for (const p of paragraphs) {
          const textNodes = Array.from(p.getElementsByTagNameNS('*', 't'));
          const line = textNodes
            .map((tn) => tn.textContent || '')
            .join('')
            .trim();
          if (line) {
            shapeLines.push(line);
          }
        }

        if (shapeLines.length === 0) continue;

        if (isTitleShape && !slideTitle) {
          slideTitle = shapeLines.join(' - ');
        } else {
          for (const line of shapeLines) {
            if (!slideTitle) {
              slideTitle = line;
            } else if (line !== slideTitle && !bullets.includes(line)) {
              bullets.push(line);
            }
          }
        }
      }

      // Fallback if no <p:sp> matched: extract all <a:t> directly
      if (!slideTitle && bullets.length === 0) {
        const allTextNodes = Array.from(xmlDoc.getElementsByTagNameNS('*', 't'));
        const allTexts = allTextNodes
          .map((n) => (n.textContent || '').trim())
          .filter(Boolean);
        if (allTexts.length > 0) {
          slideTitle = allTexts[0];
          for (let i = 1; i < allTexts.length; i++) {
            if (allTexts[i] !== slideTitle && !bullets.includes(allTexts[i])) {
              bullets.push(allTexts[i]);
            }
          }
        }
      }

      // Extract Speaker Notes if present (ppt/notesSlides/notesSlideN.xml)
      let notes = '';
      const notesPath = `ppt/notesSlides/notesSlide${num}.xml`;
      const notesXmlStr = await zip.file(notesPath)?.async('string');
      if (notesXmlStr) {
        const notesDoc = parser.parseFromString(notesXmlStr, 'application/xml');
        const noteParagraphs = Array.from(notesDoc.getElementsByTagNameNS('*', 'p'));
        const noteLines: string[] = [];
        for (const np of noteParagraphs) {
          const tNodes = Array.from(np.getElementsByTagNameNS('*', 't'));
          const line = tNodes
            .map((t) => t.textContent || '')
            .join('')
            .trim();
          // Filter out bare slide number placeholders in notes
          if (line && line !== String(num) && line !== String(slideNumber)) {
            noteLines.push(line);
          }
        }
        if (noteLines.length > 0) {
          notes = noteLines.join('\n');
        }
      }

      // Extract first embedded image if present via ppt/slides/_rels/slideN.xml.rels
      let imageDataUrl: string | undefined;
      try {
        const relsPath = `ppt/slides/_rels/slide${num}.xml.rels`;
        const relsStr = await zip.file(relsPath)?.async('string');
        if (relsStr) {
          const relsDoc = parser.parseFromString(relsStr, 'application/xml');
          const relationships = Array.from(relsDoc.getElementsByTagName('Relationship'));
          for (const rel of relationships) {
            const typeAttr = rel.getAttribute('Type') || '';
            const targetAttr = rel.getAttribute('Target') || '';
            if (typeAttr.includes('/image') && targetAttr) {
              const normalizedPath = targetAttr.replace(/^\.\.\//, 'ppt/');
              const imgFile = zip.file(normalizedPath);
              if (imgFile) {
                const uint8 = await imgFile.async('uint8array');
                // Keep embedded image reasonable (< 450KB) for fast storage
                if (uint8.byteLength < 450 * 1024) {
                  const base64 = await imgFile.async('base64');
                  const ext = normalizedPath.split('.').pop()?.toLowerCase() || 'png';
                  const mime =
                    ext === 'jpg' || ext === 'jpeg'
                      ? 'image/jpeg'
                      : ext === 'gif'
                      ? 'image/gif'
                      : ext === 'svg'
                      ? 'image/svg+xml'
                      : 'image/png';
                  imageDataUrl = `data:${mime};base64,${base64}`;
                  break;
                }
              }
            }
          }
        }
      } catch {
        // Ignore image extraction errors
      }

      const finalTitle = slideTitle || `Slide ${slideNumber}`;
      const contentText =
        bullets.length > 0
          ? bullets.join('\n• ')
          : notes || `Nội dung trình chiếu tại Slide ${slideNumber}: ${finalTitle}`;

      slides.push({
        id: `slide-${slideNumber}`,
        slideNumber,
        title: finalTitle,
        bullets: bullets.length > 0 ? bullets : [contentText],
        contentText: `${finalTitle}\n${bullets.map((b) => `- ${b}`).join('\n')}${notes ? `\nGhi chú giảng viên: ${notes}` : ''}`,
        notes: notes || undefined,
        imageDataUrl,
      });
    }

    return slides;
  } catch (err: any) {
    console.error('PPTX parse error:', err);
    throw new Error(
      err?.message || 'Không thể đọc cấu trúc tệp .pptx. Vui lòng chọn tệp PowerPoint (.pptx) hợp lệ.'
    );
  }
}

/**
 * Deterministic + AI 3-Stage Decomposer for a Creator's Practice ProjectDocument
 * Splits any uploaded 3D circuit project into 3 stages:
 *   Stage 1: Thêm thiết bị / mạch (Component Placement)
 *   Stage 2: Nối dây (Circuit Wiring)
 *   Stage 3: Chạy mô phỏng (Simulation & Verification)
 */
export function buildDeterministicPracticeStages(
  project: ProjectDocument,
  lessonTitle: string,
  shortDescription: string
): { stages: PracticeStage[]; summary: string } {
  const components = project?.components || [];
  const connections = project?.connections || [];

  // Map component instanceId -> readable label
  const compMap = new Map<string, { name: string; definitionId: string; paramStr: string }>();
  components.forEach((c, i) => {
    const friendly = getFriendlyComponentName(c.definitionId, c.name);
    const params: string[] = [];
    if (c.parameters?.voltage !== undefined) params.push(`${c.parameters.voltage}V`);
    if (c.parameters?.resistance !== undefined) params.push(`${c.parameters.resistance}Ω`);
    if (c.parameters?.color) params.push(`Màu ${c.parameters.color}`);
    if (c.parameters?.capacitance !== undefined) params.push(`${c.parameters.capacitance}µF`);
    const paramStr = params.length > 0 ? ` (${params.join(', ')})` : '';
    const displayName = c.name || `${friendly} #${i + 1}`;
    compMap.set(c.instanceId, {
      name: displayName,
      definitionId: c.definitionId,
      paramStr,
    });
  });

  // Group components by definitionId for counts & checklist
  const stage1Checklist: PracticeStageChecklistItem[] = components.map((c, idx) => {
    const info = compMap.get(c.instanceId)!;
    return {
      id: `chk-comp-${c.instanceId || idx}`,
      label: `Thêm ${info.name}${info.paramStr}`,
      detail: `Loại linh kiện: ${getFriendlyComponentName(c.definitionId)} — Đặt lên bo mạch 3D tại vị trí thông thoáng.`,
      componentDefId: c.definitionId,
      expectedCount: 1,
    };
  });

  const stage1Steps =
    components.length > 0
      ? components.map((c, idx) => {
          const info = compMap.get(c.instanceId)!;
          return `Bước 1.${idx + 1}: Từ bảng Thư viện linh kiện bên trái, chọn và đặt "${info.name}${info.paramStr}" (${getFriendlyComponentName(
            c.definitionId
          )}) lên bo mạch 3D.`;
        })
      : [
          'Bước 1.1: Từ bảng Thư viện linh kiện bên trái, thêm Nguồn DC 5V, Điện trở 220Ω và Đèn LED lên bo mạch 3D.',
        ];

  // Stage 2: Wiring
  const stage2Checklist: PracticeStageChecklistItem[] = connections.map((conn, idx) => {
    const fromInfo = compMap.get(conn.fromComponentId) || {
      name: conn.fromComponentId,
      definitionId: conn.fromComponentId,
      paramStr: '',
    };
    const toInfo = compMap.get(conn.toComponentId) || {
      name: conn.toComponentId,
      definitionId: conn.toComponentId,
      paramStr: '',
    };

    return {
      id: `chk-wire-${conn.id || idx}`,
      label: `Nối dây từ [${fromInfo.name} • chân ${conn.fromPinId.toUpperCase()}] → [${toInfo.name} • chân ${conn.toPinId.toUpperCase()}]`,
      detail: `Dùng công cụ Nối dây (Wire), nhấp vào chân ${conn.fromPinId.toUpperCase()} của ${fromInfo.name} và kéo tới chân ${conn.toPinId.toUpperCase()} của ${toInfo.name}.`,
      connectionRef: {
        fromComponentName: fromInfo.name,
        fromDefinitionId: fromInfo.definitionId,
        fromPinId: conn.fromPinId,
        toComponentName: toInfo.name,
        toDefinitionId: toInfo.definitionId,
        toPinId: conn.toPinId,
      },
    };
  });

  const stage2Steps =
    connections.length > 0
      ? connections.map((conn, idx) => {
          const fromInfo = compMap.get(conn.fromComponentId);
          const toInfo = compMap.get(conn.toComponentId);
          const fromLabel = fromInfo ? `${fromInfo.name} (chân ${conn.fromPinId.toUpperCase()})` : `${conn.fromComponentId}.${conn.fromPinId}`;
          const toLabel = toInfo ? `${toInfo.name} (chân ${conn.toPinId.toUpperCase()})` : `${conn.toComponentId}.${conn.toPinId}`;
          return `Bước 2.${idx + 1}: Nối dây dẫn từ ${fromLabel} sang ${toLabel}.`;
        })
      : [
          'Bước 2.1: Nối cực dương (VCC) của nguồn qua điện trở hạn dòng tới chân Anode (+) của tải/LED.',
          'Bước 2.2: Nối chân Cathode (-) của tải/LED về cực âm (GND) của nguồn để khép kín mạch điện.',
        ];

  // Stage 3: Simulation
  const stage3Steps = [
    'Bước 3.1: Kiểm tra bảng Kiểm tra mạch (DRC) ở thanh dưới để đảm bảo không có cảnh báo đoản mạch hoặc chân linh kiện bị hở.',
    'Bước 3.2: Nhấn nút "Chạy Mô phỏng" (Run Simulation) trên thanh công cụ phía trên.',
    `Bước 3.3: Quan sát dòng chảy hạt điện tích trên dây dẫn và trạng thái hoạt động của ${
      components.map((c) => compMap.get(c.instanceId)?.name).filter(Boolean).join(', ') || 'các linh kiện trong mạch'
    }, sau đó nhấn "Hoàn thành bài thực hành".`,
  ];

  const stage3Checklist: PracticeStageChecklistItem[] = [
    {
      id: 'chk-sim-drc',
      label: 'Mạch điện không có lỗi đoản mạch (DRC hợp lệ)',
      detail: 'Đảm bảo các linh kiện được phân cực đúng và có điện trở bảo vệ phù hợp.',
    },
    {
      id: 'chk-sim-run',
      label: 'Bật Chạy Mô phỏng (Run Simulation) và kiểm nghiệm mạch kín',
      detail: 'Kích hoạt chế độ mô phỏng thời gian thực và quan sát trạng thái linh kiện.',
    },
  ];

  const stages: PracticeStage[] = [
    {
      stageNumber: 1,
      stageKey: 'components',
      title: 'Giai đoạn 1: Thêm thiết bị & Linh kiện lên mạch',
      description: `Chuẩn bị và bố trí đầy đủ ${components.length} linh kiện cần thiết lên không gian bo mạch 3D theo thiết kế chuẩn của giảng viên.`,
      steps: stage1Steps,
      checklist: stage1Checklist,
    },
    {
      stageNumber: 2,
      stageKey: 'wiring',
      title: 'Giai đoạn 2: Nối dây mạch điện',
      description: `Thực hiện ${connections.length} kết nối dây dẫn chính xác giữa các chân pin của linh kiện để tạo thành mạch điện hoàn chỉnh.`,
      steps: stage2Steps,
      checklist: stage2Checklist,
    },
    {
      stageNumber: 3,
      stageKey: 'simulation',
      title: 'Giai đoạn 3: Chạy mô phỏng & Kiểm tra kết quả',
      description: 'Vận hành mô phỏng điện học thời gian thực, kiểm tra an toàn mạch (DRC) và đánh giá kết quả thực hành.',
      steps: stage3Steps,
      checklist: stage3Checklist,
    },
  ];

  const summary =
    shortDescription?.trim() ||
    `Bài thực hành "${lessonTitle}": Lắp ráp mạch gồm ${components.length} linh kiện (${components
      .map((c) => compMap.get(c.instanceId)?.name)
      .join(', ')}) và ${connections.length} đường dây nối, sau đó chạy mô phỏng kiểm nghiệm.`;

  return { stages, summary };
}

/**
 * Call backend AI endpoint to enrich the 3-stage breakdown from the creator's uploaded project
 */
export async function analyzePracticeProjectWithAI(
  project: ProjectDocument,
  lessonTitle: string,
  shortDescription: string
): Promise<{ stages: PracticeStage[]; summary: string }> {
  const base = buildDeterministicPracticeStages(project, lessonTitle, shortDescription);

  try {
    const res = await fetch('/api/courses/analyze-practice-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project,
        lessonTitle,
        shortDescription,
        baseStages: base.stages,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.stages) && data.stages.length === 3) {
        return {
          stages: data.stages,
          summary: data.summary || base.summary,
        };
      }
    }
  } catch (e) {
    console.warn('AI practice project analysis fallback to deterministic 3-stage decomposition:', e);
  }

  return base;
}
