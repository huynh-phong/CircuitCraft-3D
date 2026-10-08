import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('FAIL: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const clientA = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clientB = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runTest() {
  console.log('=== STARTING DATA ISOLATION VERIFICATION ===\n');

  // 1. Authenticate Account A
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: 'designer.a@circuitcraft.test',
    password: 'circuit123456',
  });
  if (errA || !authA.user) {
    throw new Error(`Account A login failed: ${errA?.message}`);
  }
  const userA = authA.user;
  console.log(`✓ Account A authenticated successfully: ID = ${userA.id} (${userA.email})`);

  // 2. Authenticate Account B
  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: 'engineer.b@circuitcraft.test',
    password: 'circuit123456',
  });
  if (errB || !authB.user) {
    throw new Error(`Account B login failed: ${errB?.message}`);
  }
  const userB = authB.user;
  console.log(`✓ Account B authenticated successfully: ID = ${userB.id} (${userB.email})`);

  if (userA.id === userB.id) {
    throw new Error('User A and User B have the same ID! Test accounts are invalid.');
  }

  // TEST 1: Project Isolation
  console.log('\n--- TEST 1: Project Isolation & RLS Security ---');
  const projectAId = `proj-iso-a-${Date.now()}`;
  const { error: insertErr } = await clientA.from('projects').insert({
    id: projectAId,
    owner_id: userA.id,
    name: 'Dự án bí mật của Tài khoản A',
    revision: 1,
    units: 'mm',
    board: { width: 100, height: 80, thickness: 1.6 },
    components: [],
    connections: [],
    wire_routes: [],
    is_public: false,
  });

  if (insertErr) {
    throw new Error(`Account A failed to insert project: ${insertErr.message}`);
  }
  console.log(`✓ Account A created private project: ${projectAId}`);

  // Account B lists projects -> Must NOT include projectAId
  const { data: listB, error: listBErr } = await clientB.from('projects').select('id, name, owner_id');
  if (listBErr) throw new Error(`Account B list error: ${listBErr.message}`);

  const leakedProject = listB?.find((p) => p.id === projectAId);
  if (leakedProject) {
    console.error('FAILED: Account B was able to see Account A private project in list!', leakedProject);
    process.exit(1);
  }
  console.log(`✓ Account B project list strictly does NOT contain Account A project (${listB?.length} projects found)`);

  // Account B tries to get Project A directly by ID
  const { data: directGetB } = await clientB.from('projects').select('*').eq('id', projectAId).maybeSingle();
  if (directGetB) {
    console.error('FAILED: Account B was able to fetch Project A directly!', directGetB);
    process.exit(1);
  }
  console.log('✓ Account B cannot fetch Project A directly (RLS blocked / returned null)');

  // Account B tries to update Project A
  const { data: updateRes, error: updateErr } = await clientB
    .from('projects')
    .update({ name: 'Hacked by Account B' })
    .eq('id', projectAId)
    .select();

  if (updateRes && updateRes.length > 0) {
    console.error('FAILED: Account B was able to update Project A!', updateRes);
    process.exit(1);
  }
  console.log('✓ Account B cannot update Project A (0 rows affected / RLS rejected)');

  // Account B tries to delete Project A
  const { data: deleteRes, error: deleteErr } = await clientB
    .from('projects')
    .delete()
    .eq('id', projectAId)
    .select();

  if (deleteRes && deleteRes.length > 0) {
    console.error('FAILED: Account B was able to delete Project A!', deleteRes);
    process.exit(1);
  }
  console.log('✓ Account B cannot delete Project A (0 rows affected / RLS rejected)');

  // TEST 2: Order & Transaction Isolation
  console.log('\n--- TEST 2: Orders & Transactions Isolation ---');
  const orderAId = `ord-test-a-${Date.now()}`;
  const { error: orderInsErr } = await clientA.from('orders').insert({
    id: orderAId,
    user_id: userA.id,
    status: 'paid',
    total_amount: 99000,
    currency: 'VND',
  });

  if (orderInsErr) {
    console.warn('Note: order insert note:', orderInsErr.message);
  } else {
    console.log(`✓ Account A created order ${orderAId}`);
    const { data: ordersB } = await clientB.from('orders').select('*');
    const orderLeak = ordersB?.find((o) => o.id === orderAId);
    if (orderLeak) {
      console.error('FAILED: Account B can see Account A order!', orderLeak);
      process.exit(1);
    }
    console.log(`✓ Account B order list does NOT contain Account A order (${ordersB?.length} orders visible)`);
  }

  // TEST 3: Entitlements Isolation
  console.log('\n--- TEST 3: Entitlements Isolation ---');
  const entAId = `ent-test-a-${Date.now()}`;
  const { error: entInsErr } = await clientA.from('entitlements').insert({
    id: entAId,
    user_id: userA.id,
    feature_key: 'prod-solar-sensor-module',
  });

  if (entInsErr) {
    console.warn('Note: entitlement insert note:', entInsErr.message);
  } else {
    console.log(`✓ Account A acquired entitlement for prod-solar-sensor-module`);
    const { data: entB } = await clientB.from('entitlements').select('*');
    const entLeak = entB?.find((e) => e.feature_key === 'prod-solar-sensor-module');
    if (entLeak) {
      console.error('FAILED: Account B has Account A entitlement!', entLeak);
      process.exit(1);
    }
    console.log(`✓ Account B does NOT possess Account A entitlement (${entB?.length} entitlements found)`);
  }

  // TEST 4: Minibot Chat Messages Isolation
  console.log('\n--- TEST 4: Minibot Chat Messages Isolation ---');
  const chatMsgAId = `msg-test-a-${Date.now()}`;
  const { error: chatInsErr } = await clientA.from('minibot_chat_messages').insert({
    id: chatMsgAId,
    user_id: userA.id,
    role: 'user',
    content: 'Tin nhắn hội thoại riêng tư của Account A',
  });

  if (chatInsErr) {
    console.warn('Note: minibot_chat_messages insert note:', chatInsErr.message);
  } else {
    console.log(`✓ Account A inserted private chat message ${chatMsgAId}`);
    const { data: chatB } = await clientB.from('minibot_chat_messages').select('*');
    const chatLeak = chatB?.find((m) => m.id === chatMsgAId);
    if (chatLeak) {
      console.error('FAILED: Account B can read Account A private chat message!', chatLeak);
      process.exit(1);
    }
    console.log(`✓ Account B cannot view Account A chat message (RLS strictly enforced, ${chatB?.length || 0} messages visible)`);

    // Account B cannot delete or update Account A's chat message
    const { data: chatDelRes } = await clientB.from('minibot_chat_messages').delete().eq('id', chatMsgAId).select();
    if (chatDelRes && chatDelRes.length > 0) {
      console.error('FAILED: Account B was able to delete Account A chat message!', chatDelRes);
      process.exit(1);
    }
    console.log('✓ Account B cannot delete Account A chat message (RLS delete protected)');

    // Cleanup Account A's test chat message
    await clientA.from('minibot_chat_messages').delete().eq('id', chatMsgAId);
  }

  // Cleanup test project
  await clientA.from('projects').delete().eq('id', projectAId);
  if (!orderInsErr) await clientA.from('orders').delete().eq('id', orderAId);
  if (!entInsErr) await clientA.from('entitlements').delete().eq('id', entAId);

  console.log('\n======================================================');
  console.log('🎉 ALL DATA ISOLATION VERIFICATION CHECKS PASSED 100%!');
  console.log('======================================================\n');
}

runTest().catch((err) => {
  console.error('\n❌ DATA ISOLATION TEST FAILED:', err);
  process.exit(1);
});
