import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Mock localStorage for Node environment to test storageNamespace & repositories
class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

(global as any).localStorage = new MockLocalStorage();

import { authService } from '../src/persistence/authService';
import { supabaseProjectRepository } from '../src/persistence/supabaseRepository';
import { localProjectRepository } from '../src/persistence/localRepository';
import { courseService } from '../src/domain/courses/courseService';
import { paymentService } from '../src/billing/paymentService';

async function runE2EIsolationTest() {
  console.log('=== STARTING END-TO-END DATA ISOLATION TEST ===\n');

  // STEP 1: Log in as Account A
  console.log('1. Logging in as Account A (designer.a@circuitcraft.test)...');
  const loginARes = await authService.signIn('designer.a@circuitcraft.test', 'circuit123456');
  if (!loginARes.success) {
    throw new Error(`Login A failed: ${loginARes.error}`);
  }
  const userA = authService.getCurrentUser()!;
  console.log(`✓ Account A logged in: ${userA.id}`);

  // Account A enrolls in Course 1 & completes Lesson 1-1
  courseService.enroll('course-intro-stem-3d');
  courseService.completeLesson('course-intro-stem-3d', 'syl-1-1');
  const myCoursesA = courseService.getMyCourses();
  const completedLessonsA = courseService.getCompletedLessonIds();
  console.log(`✓ Account A has ${myCoursesA.length} enrolled courses and ${completedLessonsA.length} completed lessons`);
  if (!completedLessonsA.includes('syl-1-1')) {
    throw new Error('Lesson 1-1 was not recorded for Account A');
  }

  // Account A places an order & upgrades plan
  const orderA = await paymentService.createOrder('prod-test-a', 'Sản phẩm thử nghiệm A', 49000);
  await paymentService.processSandboxPayment(orderA.orderId);
  paymentService.updatePlan('student');
  const accountA = paymentService.getAccountInfo();
  const ordersA = paymentService.getOrders();
  console.log(`✓ Account A plan: ${accountA.plan}, orders: ${ordersA.length}, entitlements: ${accountA.entitlements.length}`);

  // Account A saves a project
  const projectAId = `proj-cloud-a-${Date.now()}`;
  const saveARes = await supabaseProjectRepository.saveProject({
    projectId: projectAId,
    name: 'Mạch của Account A',
    units: 'mm',
    board: { width: 100, height: 80, thickness: 1.6 },
    components: [],
    connections: [],
    wireRoutes: [],
    revision: 1,
    authorId: userA.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log(`✓ Account A saved project result: ${saveARes.success}`);

  // STEP 2: Sign out Account A
  console.log('\n2. Signing out Account A...');
  await authService.signOut();
  console.log(`✓ Current user after signOut: ${authService.getCurrentUser()}`);

  // STEP 3: Log in as Account B
  console.log('\n3. Logging in as Account B (engineer.b@circuitcraft.test)...');
  const loginBRes = await authService.signIn('engineer.b@circuitcraft.test', 'circuit123456');
  if (!loginBRes.success) {
    throw new Error(`Login B failed: ${loginBRes.error}`);
  }
  const userB = authService.getCurrentUser()!;
  console.log(`✓ Account B logged in: ${userB.id}`);

  // Check Account B's state -> Must be completely clean and NOT contain Account A's data!
  const myCoursesB = courseService.getMyCourses();
  const completedLessonsB = courseService.getCompletedLessonIds();
  const accountB = paymentService.getAccountInfo();
  const ordersB = paymentService.getOrders();
  const projectsB = await supabaseProjectRepository.listProjects();

  console.log(`- Account B courses count: ${myCoursesB.length}`);
  console.log(`- Account B completed lessons: ${completedLessonsB.length}`);
  console.log(`- Account B plan: ${accountB.plan}`);
  console.log(`- Account B orders: ${ordersB.length}`);
  console.log(`- Account B projects: ${projectsB.length}`);

  // Assertions for Account B:
  if (completedLessonsB.includes('syl-1-1')) {
    throw new Error('DATA LEAK: Account B has Account A completed lesson syl-1-1!');
  }
  if (myCoursesB.some((c) => c.course.id === 'course-intro-stem-3d')) {
    throw new Error('DATA LEAK: Account B has Account A course enrollment!');
  }
  if (ordersB.some((o) => o.orderId === orderA.orderId)) {
    throw new Error('DATA LEAK: Account B has Account A order!');
  }
  if (accountB.entitlements.includes('prod-test-a')) {
    throw new Error('DATA LEAK: Account B has Account A entitlement!');
  }
  if (accountB.plan !== 'free') {
    throw new Error(`DATA LEAK: Account B has Account A plan '${accountB.plan}'! Expected 'free'`);
  }
  if (projectsB.some((p) => p.projectId === projectAId)) {
    throw new Error('DATA LEAK: Account B sees Account A project!');
  }
  console.log('✓ VERIFIED: Account B has ZERO data leaked from Account A!');

  // Now Account B performs their own actions
  console.log('\n4. Account B creates their own separate data...');
  courseService.enroll('course-advanced-iot');
  courseService.completeLesson('course-advanced-iot', 'syl-iot-1');
  paymentService.updatePlan('creator');
  const orderB = await paymentService.createOrder('prod-test-b', 'Sản phẩm B', 99000);
  await paymentService.processSandboxPayment(orderB.orderId);

  // STEP 4: Sign out Account B and Sign back into Account A
  console.log('\n5. Switching back to Account A...');
  await authService.signOut();
  await authService.signIn('designer.a@circuitcraft.test', 'circuit123456');

  const myCoursesA2 = courseService.getMyCourses();
  const completedLessonsA2 = courseService.getCompletedLessonIds();
  const accountA2 = paymentService.getAccountInfo();
  const ordersA2 = paymentService.getOrders();

  console.log(`- Account A courses count: ${myCoursesA2.length}`);
  console.log(`- Account A completed lessons: ${completedLessonsA2.length}`);
  console.log(`- Account A plan: ${accountA2.plan}`);
  console.log(`- Account A orders: ${ordersA2.length}`);

  if (completedLessonsA2.includes('syl-iot-1')) {
    throw new Error('DATA LEAK: Account A has Account B completed lesson syl-iot-1!');
  }
  if (myCoursesA2.some((c) => c.course.id === 'course-advanced-iot')) {
    throw new Error('DATA LEAK: Account A has Account B course advanced-iot!');
  }
  if (ordersA2.some((o) => o.orderId === orderB.orderId)) {
    throw new Error('DATA LEAK: Account A has Account B order!');
  }
  if (accountA2.plan !== 'student') {
    throw new Error(`Account A lost their plan. Found '${accountA2.plan}', expected 'student'`);
  }

  // Cleanup project A from Cloud
  await supabaseProjectRepository.deleteProject(projectAId);

  console.log('\n======================================================');
  console.log('🎉 COMPLETE MULTI-USER ISOLATION E2E TEST PASSED 100%!');
  console.log('======================================================\n');
}

runE2EIsolationTest().catch((err) => {
  console.error('❌ E2E ISOLATION TEST FAILED:', err);
  process.exit(1);
});
