/**
 * Chat plumbing: conversation building, model time limits, math normalisation, nav tags.
 * No network: the Gemini client is replaced by small fakes.
 * Run with: npx tsx test/ai_chat.test.ts
 */
import assert from 'node:assert/strict';
import { buildChatContents, generateWithGemini, geminiModels, answerStyle } from '../src/server/gemini.ts';
import { normalizeMath } from '../src/components/ui/chatMath.ts';
import { parseNavActions } from '../src/services/supportChatService.ts';

let passed = 0;
const failures: string[] = [];
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failures.push(`${name}: ${err?.message || err}`);
    console.log(`  ✗ ${name}\n      ${err?.message || err}`);
  }
}

const roles = (contents: any[]) => contents.map((c) => c.role).join(',');

async function main() {
  console.log('\n[1] Conversation sent to the model');
  await check('Câu hỏi mới chỉ xuất hiện một lần dù client gửi kèm trong lịch sử', () => {
    const c = buildChatContents([{ role: 'user', content: 'Xin chào' }, { role: 'assistant', content: 'Chào bạn' }, { role: 'user', content: 'Thủ đô Nhật?' }], 'Thủ đô Nhật?');
    assert.equal(roles(c), 'user,model,user');
    assert.equal(c[2].parts[0].text, 'Thủ đô Nhật?');
  });
  await check('Bắt đầu bằng user, xen kẽ vai, gộp lượt liền nhau, bỏ lượt rỗng', () => {
    const c = buildChatContents(
      [
        { role: 'assistant', content: 'Lời chào' },
        { role: 'user', content: 'A' },
        { role: 'user', content: 'B' },
        { role: 'assistant', content: '' },
        { role: 'assistant', content: 'C' },
        { role: 'assistant', content: 'D' },
      ],
      'E'
    );
    assert.equal(roles(c), 'user,model,user');
    assert.equal(c[0].parts[0].text, 'A\n\nB');
    assert.equal(c[1].parts[0].text, 'C\n\nD');
  });
  await check('Lịch sử không hợp lệ vẫn cho ra hội thoại hợp lệ', () => {
    assert.equal(roles(buildChatContents(null, 'Hỏi')), 'user');
    assert.equal(roles(buildChatContents([{ foo: 1 }, 'x'], 'Hỏi')), 'user');
  });
  await check('Lời dặn: lạc đề trả lời ngắn rồi quay lại, từ chối khéo yêu cầu lạm dụng, ví dụ công thức đúng', () => {
    for (const topic of ['support', 'circuit', 'tutor'] as const) {
      const vi = answerStyle('vi', topic);
      assert.match(vi, /một đến hai câu/);
      assert.match(vi, /quay lại chủ đề chính/);
      assert.match(vi, /Từ chối khéo/);
      assert.match(vi, /lập trình website/);
      assert.match(vi, /hack/);
      // The examples reach the model with their backslashes (a template string would eat them)
      assert.ok(vi.includes('$I = \\frac{U}{R}$') && vi.includes('$220\\,\\Omega$'), 'LaTeX examples intact');
      assert.match(answerStyle('en', topic), /Politely decline/);
    }
    assert.notEqual(answerStyle('vi', 'support'), answerStyle('vi', 'tutor'));
  });

  console.log('\n[2] Model time limits (fake client)');
  const fakeAi = (behaviour: Record<string, 'hang' | 'fail' | 'ok'>) => {
    const calls: string[] = [];
    return {
      calls,
      models: {
        generateContent: ({ model, config }: any) => {
          calls.push(model);
          const mode = behaviour[model] || 'ok';
          if (mode === 'ok') return Promise.resolve({ text: `answer from ${model}` });
          if (mode === 'fail') return Promise.reject(new Error('404 model not found'));
          return new Promise((_, reject) => config.abortSignal?.addEventListener('abort', () => reject(new Error('aborted'))));
        },
      },
    } as any;
  };
  await check('Model treo bị cắt theo thời hạn, chuyển sang model sau và vẫn kịp trả lời', async () => {
    process.env.GEMINI_MODELS = 'slow-model,fast-model';
    const ai = fakeAi({ 'slow-model': 'hang' });
    const t = Date.now();
    const r: any = await generateWithGemini(ai, { contents: [] }, { deadlineMs: 4_000 });
    assert.equal(r.text, 'answer from fast-model');
    assert.ok(Date.now() - t < 4_500, `took ${Date.now() - t} ms`);
  });
  await check('Model vừa trả lời được thử trước ở lần sau', async () => {
    assert.deepEqual(geminiModels(), ['fast-model', 'slow-model']);
  });
  await check('Mọi model đều lỗi: báo lỗi (để route trả thông báo thật), không bịa câu trả lời', async () => {
    process.env.GEMINI_MODELS = 'a,b';
    await assert.rejects(() => generateWithGemini(fakeAi({ a: 'fail', b: 'fail' }), { contents: [] }, { deadlineMs: 4_000 }));
  });
  await check('Không bao giờ vượt thời hạn tổng dù mọi model đều treo', async () => {
    process.env.GEMINI_MODELS = 'h1,h2';
    const t = Date.now();
    await assert.rejects(() => generateWithGemini(fakeAi({ h1: 'hang', h2: 'hang' }), { contents: [] }, { deadlineMs: 5_000 }));
    assert.ok(Date.now() - t < 5_500, `took ${Date.now() - t} ms`);
  });
  delete process.env.GEMINI_MODELS;

  console.log('\n[3] Formula and tag formatting');
  await check('\\( \\) và \\[ \\] được đổi sang $ và $$', () => {
    assert.equal(normalizeMath('Dòng \\(I = U/R\\) nhé'), 'Dòng $I = U/R$ nhé');
    assert.match(normalizeMath('Ta có \\[I = \\frac{U}{R}\\]'), /\n\$\$\nI = \\frac\{U\}\{R\}\n\$\$\n/);
  });
  await check('$$...$$ viết giữa câu được tách thành khối riêng (như ảnh lỗi)', () => {
    const out = normalizeMath('mạch: $$I = \\frac{3\\text{V}}{220\\,\\Omega}$$');
    assert.match(out, /mạch:\n\n\$\$\nI = /);
  });
  await check('Thẻ [nav:...] thành tên mục in đậm, không để câu bị hụt chữ', () => {
    assert.equal(parseNavActions('Vào [nav:projects] để thử').cleanText, 'Vào **Thiết kế 3D** để thử');
    assert.equal(parseNavActions('Xem [nav:courses] (Khóa học) nhé').cleanText, 'Xem **Khóa học** nhé');
    assert.equal(parseNavActions('Xem [nav:courses] (Khóa học) nhé').actions.length, 1);
  });

  console.log(`\nAI chat: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
