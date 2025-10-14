
import { kv } from '@vercel/kv';

const JOB_LIMIT_KEY = 'apple_limit_key';
const MAX_OPERATIONS = 100;

export interface LimitCheckResult {
  allowed: boolean;
  currentCount: number;
  message: string;
}

/**
 * 原子性操作：检查并增加操作计数
 * 使用 Redis INCR 命令保证原子性，不会出现竞态条件
 * @param userId 用户ID，默认为 'default'
 * @returns LimitCheckResult - 包含是否允许操作、当前计数和消息
 */
export async function checkAndIncrementLimit(): Promise<LimitCheckResult> {
  try {
    const limitKey = `${JOB_LIMIT_KEY}`;
    
    // 使用 INCR 命令原子性地增加计数并返回新值
    // INCR 是原子操作，即使多个请求同时到达也不会出现竞态条件
    const newCount = await kv.incr(limitKey);
    
    // 设置过期时间（可选）：24小时后自动重置计数
    // 只在第一次创建时设置过期时间
    if (newCount === 1) {
      await kv.expire(limitKey, 86400); // 86400秒 = 24小时
    }
    console.log(`🕹🕹🕹🕹🕹🕹🕹 [CHECK_LIMIT] New count: ${newCount}`);
    // 检查是否超过限制
    if (newCount > MAX_OPERATIONS) {
      // 如果超过限制，不回滚计数（保持严格限制）
      console.log(`🕹🕹🕹🕹🕹🕹🕹 [CHECK_LIMIT] New count: ${newCount} > MAX_OPERATIONS: ${MAX_OPERATIONS}`);
      return {
        allowed: false,
        currentCount: newCount,
        message: `操作次数已超过限制 (${newCount}/${MAX_OPERATIONS})，请稍后再试`
      };
    }
    console.log(`🕹🕹🕹🕹🕹🕹🕹 [CHECK_LIMIT] New count: ${newCount} <= MAX_OPERATIONS: ${MAX_OPERATIONS}`);
    return {
      allowed: true,
      currentCount: newCount,
      message: `操作成功，当前计数: ${newCount}/${MAX_OPERATIONS}`
    };
  } catch (error) {
    console.error('[CHECK_LIMIT] Error checking limit:', error);
    // 发生错误时默认拒绝操作，保证安全性
    return {
      allowed: false,
      currentCount: 0,
      message: '系统错误，无法验证操作限制'
    };
  }
}

/**
 * 获取当前操作计数（不增加计数）
 * @param userId 用户ID，默认为 'default'
 * @returns 当前操作次数
 */
export async function getCurrentCount(userId: string = 'default'): Promise<number> {
  try {
    const limitKey = `${JOB_LIMIT_KEY}_${userId}`;
    const count = await kv.get<number>(limitKey);
    return count ?? 0;
  } catch (error) {
    console.error('[GET_COUNT] Error getting count:', error);
    return 0;
  }
}

/**
 * 重置操作计数（管理员功能）
 * @param userId 用户ID，默认为 'default'
 * @returns 是否重置成功
 */
export async function resetLimit(userId: string = 'default'): Promise<boolean> {
  try {
    const limitKey = `${JOB_LIMIT_KEY}_${userId}`;
    await kv.set(limitKey, 0);
    return true;
  } catch (error) {
    console.error('[RESET_LIMIT] Error resetting limit:', error);
    return false;
  }
}

/**
 * 减少操作计数（回滚操作时使用）
 * @param userId 用户ID，默认为 'default'
 * @returns 新的计数值，如果失败返回 -1
 */
export async function decrementLimit(userId: string = 'default'): Promise<number> {
  try {
    const limitKey = `${JOB_LIMIT_KEY}_${userId}`;
    const newCount = await kv.decr(limitKey);
    
    // 确保计数不会小于 0
    if (newCount < 0) {
      await kv.set(limitKey, 0);
      return 0;
    }
    
    return newCount;
  } catch (error) {
    console.error('[DECREMENT_LIMIT] Error decrementing limit:', error);
    return -1;
  }
}