import { NextRequest, NextResponse } from "next/server";
import { kv } from '@vercel/kv';

// Webhook authorization token - should be moved to environment variables in production
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || "31tbbDBvLRX4Kc8WExOiX6y2OSKhZ3T6Zg+jEJThr3c=";

// 订阅状态枚举
enum SubscriptionStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    EXPIRED = 'expired',
    CANCELED = 'canceled',
    TRIAL = 'trial'
}

// 订阅计划枚举
enum SubscriptionPlan {
    FREE = 'free',
    PREMIUM = 'premium',
    PRO = 'pro',
    UNLIMITED = 'unlimited'
}

// 用户订阅信息接口
interface UserSubscription {
    userId: string;
    subscriberId: string;
    status: SubscriptionStatus;
    plan: SubscriptionPlan;
    productId: string;
    originalTransactionId: string;
    purchaseDate: string;
    expiresDate: string | null;
    isActive: boolean;
    environment: string;
    store: string;
    lastUpdated: number;
}

// 事件类型枚举
enum EventType {
    INITIAL_PURCHASE = 'INITIAL_PURCHASE',//首次购买
    NON_RENEWING_PURCHASE = 'NON_RENEWING_PURCHASE',
    RENEWAL = 'RENEWAL', //订阅自动续费成功
    PRODUCT_CHANGE = 'PRODUCT_CHANGE',
    CANCELLATION = 'CANCELLATION', //用户取消订阅
    UNCANCELLATION = 'UNCANCELLATION',//用户在订阅过期前恢复订阅
    NON_RENEWING_PURCHASE_EXPIRATION = 'NON_RENEWING_PURCHASE_EXPIRATION',
    SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',//订阅过期订阅过期
    BILLING_ISSUE = 'BILLING_ISSUE',
    SUBSCRIBER_ALIAS = 'SUBSCRIBER_ALIAS'
}

// 订阅计划配置
const SUBSCRIPTION_PLANS = {
    // 测试产品
    'test': {
        plan: SubscriptionPlan.PREMIUM,
        limits: {
            dailyGenerations: 20,
            monthlyGenerations: 500,
            storageSize: 1000,
            features: ['basic_generation', 'standard_quality', 'high_quality', 'priority_support']
        }
    },
    // 新订阅产品 - StoreKit 2025
    'StylaPy2025': {
        plan: SubscriptionPlan.PREMIUM,
        limits: {
            dailyGenerations: 30,
            monthlyGenerations: 600,
            storageSize: 2000,
            features: ['basic_generation', 'standard_quality', 'high_quality', 'priority_support']
        }
    },
    'StylaPay2025Quarterly': {
        plan: SubscriptionPlan.PRO,
        limits: {
            dailyGenerations: 60,
            monthlyGenerations: 1500,
            storageSize: 5000,
            features: ['basic_generation', 'standard_quality', 'high_quality', 'premium_quality', 'priority_support', 'advanced_features']
        }
    },
    'StylaPay2025Yearly': {
        plan: SubscriptionPlan.UNLIMITED,
        limits: {
            dailyGenerations: -1, // 无限制
            monthlyGenerations: -1,
            storageSize: -1,
            features: ['all_features', 'unlimited_generation', 'priority_support', 'beta_access']
        }
    },

};

// AI Points 消耗品配置
const AI_POINTS_PRODUCTS = {
    'AIPoints_100': {
        points: 100,
        bonus: 0,
        totalPoints: 100
    },
    'AIPoints_600': {
        points: 600,
        bonus: 50,
        totalPoints: 650
    },
    'AIPoints_1200': {
        points: 1200,
        bonus: 150,
        totalPoints: 1350
    },
    'AIPoints_2000': {
        points: 2000,
        bonus: 300,
        totalPoints: 2300
    },
    'AIPoints_3800': {
        points: 3800,
        bonus: 700,
        totalPoints: 4500
    },
    'AIPoints_10000': {
        points: 10000,
        bonus: 2500,
        totalPoints: 12500
    }
};

export async function POST(request: NextRequest) {
    try {
        // Verify Authorization header
        const authorization = request.headers.get("Authorization");
        if (!authorization) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Extract and verify Bearer token
        const token = authorization.split(" ")[1];
        if (token !== WEBHOOK_TOKEN) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse and validate request body
        const body = await request.json();
        
        // 详细打印 webhook 数据
        console.log("=== WEBHOOK RECEIVED ===");
        console.log("Timestamp:", new Date().toISOString());
        // console.log("Request Headers:", Object.fromEntries(request.headers.entries()));
        console.log("Request Method:", request.method);
        console.log("Request URL:", request.url);
        // console.log("Authorization Token:", token);
        // console.log("Raw Body:", JSON.stringify(body, null, 2));
        
        // 解析关键字段
        if (body) {
            console.log("\n=== PARSED DATA ===");
            console.log("Event Type:", body.type || "unknown");
            console.log("App User ID:", body.app_user_id || "unknown");
            console.log("Product ID:", body.product_id || "unknown");
            console.log("Original App User ID:", body.original_app_user_id || "unknown");
            console.log("Store:", body.store || "unknown");
            console.log("Environment:", body.environment || "unknown");
            
            if (body.subscriber) {
                console.log("\n=== SUBSCRIBER INFO ===");
                console.log("Subscriber ID:", body.subscriber.subscriber_id);
                console.log("Original App User ID:", body.subscriber.original_app_user_id);
                console.log("Original Application Version:", body.subscriber.original_application_version);
                console.log("First Seen:", body.subscriber.first_seen);
                console.log("Last Seen:", body.subscriber.last_seen);
                
                if (body.subscriber.entitlements) {
                    console.log("\n=== ENTITLEMENTS ===");
                    Object.entries(body.subscriber.entitlements).forEach(([key, value]: [string, any]) => {
                        console.log(`Entitlement ${key}:`, {
                            expires_date: value.expires_date,
                            product_identifier: value.product_identifier,
                            purchase_date: value.purchase_date,
                            is_active: value.is_active
                        });
                    });
                }
                
                if (body.subscriber.subscriptions) {
                    console.log("\n=== SUBSCRIPTIONS ===");
                    Object.entries(body.subscriber.subscriptions).forEach(([key, value]: [string, any]) => {
                        console.log(`Subscription ${key}:`, {
                            expires_date: value.expires_date,
                            product_identifier: value.product_identifier,
                            purchase_date: value.purchase_date,
                            is_active: value.is_active,
                            period_type: value.period_type,
                            store: value.store
                        });
                    });
                }
            }
            
            if (body.event) {
                console.log("\n=== EVENT DETAILS ===");
                console.log("Event Type:", body.event.type);
                console.log("Event ID:", body.event.id);
                console.log("Event Timestamp:", body.event.event_timestamp_ms);
                console.log("Product ID:", body.event.product_id);
                console.log("Price:", body.event.price);
                console.log("Currency:", body.event.currency);
                console.log("Period Type:", body.event.period_type);
                console.log("Store:", body.event.store);
                console.log("Environment:", body.event.environment);
            }
        }
        
        console.log("=== END WEBHOOK DATA ===\n");

        // 处理订阅事件
        const processResult = await processSubscriptionEvent(body);
        console.log("Processing result:", processResult);

        // Return success response
        return NextResponse.json({ 
            success: true, 
            message: "Webhook processed successfully",
            processed: processResult
        });

    } catch (error) {
        console.error("Webhook processing error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * 处理订阅事件的核心函数
 */
async function processSubscriptionEvent(webhookData: any): Promise<{
    success: boolean;
    action: string;
    userId?: string;
    subscriptionStatus?: string;
    message: string;
}> {
    try {
        console.log("🔄 Processing subscription event...");
        
        const eventType = webhookData.type as EventType;
        const subscriberId = webhookData.subscriber?.subscriber_id;
        const appUserId = webhookData.app_user_id || webhookData.original_app_user_id;
        
        if (!subscriberId) {
            return {
                success: false,
                action: 'validation_failed',
                message: 'Missing subscriber ID'
            };
        }

        console.log(`📊 Event Type: ${eventType}, Subscriber ID: ${subscriberId}, App User ID: ${appUserId}`);

        switch (eventType) {
            case EventType.INITIAL_PURCHASE://首次购买
                return await handleInitialPurchase(webhookData);
            
            case EventType.RENEWAL://订阅自动续费成功
                return await handleRenewal(webhookData);
            
            case EventType.CANCELLATION://用户取消订阅
                return await handleCancellation(webhookData);
            
            case EventType.UNCANCELLATION://用户在订阅过期前恢复订阅
                return await handleUncancellation(webhookData);
            
            case EventType.SUBSCRIPTION_EXPIRED://订阅过期
                return await handleSubscriptionExpired(webhookData);
            
            case EventType.BILLING_ISSUE://账单问题
                return await handleBillingIssue(webhookData);
            
            case EventType.PRODUCT_CHANGE://产品变更
                return await handleProductChange(webhookData);
            
            case EventType.NON_RENEWING_PURCHASE://非续费购买
                return await handleNonRenewingPurchase(webhookData);
            
            case EventType.NON_RENEWING_PURCHASE_EXPIRATION://非续费购买过期
                return await handleNonRenewingExpiration(webhookData);
            
            default:
                console.log(`⚠️ Unhandled event type: ${eventType}`);
                return {
                    success: true,
                    action: 'ignored',
                    message: `Event type ${eventType} is not handled`
                };
        }
    } catch (error) {
        console.error("❌ Error processing subscription event:", error);
        return {
            success: false,
            action: 'error',
            message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}

/**
 * 处理首次购买事件
 */
async function handleInitialPurchase(webhookData: any) {
    console.log("🛒 Handling initial purchase...");
    
    const subscription = await parseSubscriptionData(webhookData);
    if (!subscription) {
        return {
            success: false,
            action: 'parse_failed',
            message: 'Failed to parse subscription data'
        };
    }

    // 保存订阅信息
    await saveUserSubscription(subscription);
    
    // 记录购买事件
    await logSubscriptionEvent(subscription.userId, 'initial_purchase', {
        productId: subscription.productId,
        plan: subscription.plan,
        purchaseDate: subscription.purchaseDate
    });

    return {
        success: true,
        action: 'initial_purchase',
        userId: subscription.userId,
        subscriptionStatus: subscription.status,
        message: `Initial purchase processed for ${subscription.plan} plan`
    };
}

/**
 * 处理续费事件
 */
async function handleRenewal(webhookData: any) {
    console.log("🔄 Handling renewal...");
    
    const subscription = await parseSubscriptionData(webhookData);
    if (!subscription) {
        return {
            success: false,
            action: 'parse_failed',
            message: 'Failed to parse subscription data'
        };
    }

    // 更新订阅信息
    await saveUserSubscription(subscription);
    
    // 重置使用限制
    await resetUserUsageCounters(subscription.userId);
    
    // 记录续费事件
    await logSubscriptionEvent(subscription.userId, 'renewal', {
        productId: subscription.productId,
        plan: subscription.plan,
        expiresDate: subscription.expiresDate
    });

    return {
        success: true,
        action: 'renewal',
        userId: subscription.userId,
        subscriptionStatus: subscription.status,
        message: `Renewal processed for ${subscription.plan} plan`
    };
}

/**
 * 处理取消订阅事件
 */
async function handleCancellation(webhookData: any) {
    console.log("❌ Handling cancellation...");
    
    const subscription = await parseSubscriptionData(webhookData);
    if (!subscription) {
        return {
            success: false,
            action: 'parse_failed',
            message: 'Failed to parse subscription data'
        };
    }

    // 更新订阅状态为已取消
    subscription.status = SubscriptionStatus.CANCELED;
    subscription.isActive = false;
    
    await saveUserSubscription(subscription);
    
    // 记录取消事件
    await logSubscriptionEvent(subscription.userId, 'cancellation', {
        productId: subscription.productId,
        plan: subscription.plan,
        expiresDate: subscription.expiresDate
    });

    return {
        success: true,
        action: 'cancellation',
        userId: subscription.userId,
        subscriptionStatus: subscription.status,
        message: `Cancellation processed for ${subscription.plan} plan`
    };
}

/**
 * 处理恢复订阅事件
 */
async function handleUncancellation(webhookData: any) {
    console.log("✅ Handling uncancellation...");
    
    const subscription = await parseSubscriptionData(webhookData);
    if (!subscription) {
        return {
            success: false,
            action: 'parse_failed',
            message: 'Failed to parse subscription data'
        };
    }

    // 恢复订阅状态
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.isActive = true;
    
    await saveUserSubscription(subscription);
    
    // 记录恢复事件
    await logSubscriptionEvent(subscription.userId, 'uncancellation', {
        productId: subscription.productId,
        plan: subscription.plan,
        expiresDate: subscription.expiresDate
    });

    return {
        success: true,
        action: 'uncancellation',
        userId: subscription.userId,
        subscriptionStatus: subscription.status,
        message: `Uncancellation processed for ${subscription.plan} plan`
    };
}

/**
 * 处理订阅过期事件
 */
async function handleSubscriptionExpired(webhookData: any) {
    console.log("⏰ Handling subscription expiration...");
    
    const subscription = await parseSubscriptionData(webhookData);
    if (!subscription) {
        return {
            success: false,
            action: 'parse_failed',
            message: 'Failed to parse subscription data'
        };
    }

    // 更新订阅状态为已过期
    subscription.status = SubscriptionStatus.EXPIRED;
    subscription.isActive = false;
    
    // 降级到免费计划
    subscription.plan = SubscriptionPlan.FREE;
    
    await saveUserSubscription(subscription);
    
    // 记录过期事件
    await logSubscriptionEvent(subscription.userId, 'expiration', {
        productId: subscription.productId,
        plan: subscription.plan,
        expiresDate: subscription.expiresDate
    });

    return {
        success: true,
        action: 'expiration',
        userId: subscription.userId,
        subscriptionStatus: subscription.status,
        message: `Subscription expired, downgraded to free plan`
    };
}

/**
 * 处理账单问题事件
 */
async function handleBillingIssue(webhookData: any) {
    console.log("💳 Handling billing issue...");
    
    const subscription = await parseSubscriptionData(webhookData);
    if (!subscription) {
        return {
            success: false,
            action: 'parse_failed',
            message: 'Failed to parse subscription data'
        };
    }

    // 记录账单问题事件
    await logSubscriptionEvent(subscription.userId, 'billing_issue', {
        productId: subscription.productId,
        plan: subscription.plan,
        issue: webhookData.event?.reason || 'unknown'
    });

    return {
        success: true,
        action: 'billing_issue',
        userId: subscription.userId,
        subscriptionStatus: subscription.status,
        message: `Billing issue recorded`
    };
}

/**
 * 处理产品变更事件
 */
async function handleProductChange(webhookData: any) {
    console.log("🔄 Handling product change...");
    
    const subscription = await parseSubscriptionData(webhookData);
    if (!subscription) {
        return {
            success: false,
            action: 'parse_failed',
            message: 'Failed to parse subscription data'
        };
    }

    // 更新订阅信息
    await saveUserSubscription(subscription);
    
    // 记录产品变更事件
    await logSubscriptionEvent(subscription.userId, 'product_change', {
        productId: subscription.productId,
        plan: subscription.plan,
        expiresDate: subscription.expiresDate
    });

    return {
        success: true,
        action: 'product_change',
        userId: subscription.userId,
        subscriptionStatus: subscription.status,
        message: `Product change processed to ${subscription.plan} plan`
    };
}

/**
 * 处理非续费购买事件
 */
async function handleNonRenewingPurchase(webhookData: any) {
    console.log("🛍️ Handling non-renewing purchase...");
    
    const subscription = await parseSubscriptionData(webhookData);
    if (!subscription) {
        return {
            success: false,
            action: 'parse_failed',
            message: 'Failed to parse subscription data'
        };
    }

    // 保存订阅信息
    await saveUserSubscription(subscription);
    
    // 记录购买事件
    await logSubscriptionEvent(subscription.userId, 'non_renewing_purchase', {
        productId: subscription.productId,
        plan: subscription.plan,
        purchaseDate: subscription.purchaseDate
    });

    return {
        success: true,
        action: 'non_renewing_purchase',
        userId: subscription.userId,
        subscriptionStatus: subscription.status,
        message: `Non-renewing purchase processed for ${subscription.plan} plan`
    };
}

/**
 * 处理非续费购买过期事件
 */
async function handleNonRenewingExpiration(webhookData: any) {
    console.log("⏰ Handling non-renewing expiration...");
    
    const subscription = await parseSubscriptionData(webhookData);
    if (!subscription) {
        return {
            success: false,
            action: 'parse_failed',
            message: 'Failed to parse subscription data'
        };
    }

    // 更新订阅状态为已过期
    subscription.status = SubscriptionStatus.EXPIRED;
    subscription.isActive = false;
    
    
    await saveUserSubscription(subscription);
    
    // 记录过期事件
    await logSubscriptionEvent(subscription.userId, 'non_renewing_expiration', {
        productId: subscription.productId,
        plan: subscription.plan,
        expiresDate: subscription.expiresDate
    });

    return {
        success: true,
        action: 'non_renewing_expiration',
        userId: subscription.userId,
        subscriptionStatus: subscription.status,
        message: `Non-renewing purchase expired, downgraded to free plan`
    };
}

/**
 * 解析订阅数据
 */
async function parseSubscriptionData(webhookData: any): Promise<UserSubscription | null> {
    try {
        const subscriber = webhookData.subscriber;
        const event = webhookData.event;
        
        if (!subscriber || !event) {
            console.error("Missing subscriber or event data");
            return null;
        }

        const userId = webhookData.app_user_id || webhookData.original_app_user_id || subscriber.original_app_user_id || 'anonymous';
        const productId = event.product_id;
        const planConfig = SUBSCRIPTION_PLANS[productId as keyof typeof SUBSCRIPTION_PLANS];
        
        if (!planConfig) {
            console.error(`Unknown product ID: ${productId}`);
            return null;
        }

        // 确定订阅状态
        let status = SubscriptionStatus.INACTIVE;
        let isActive = false;
        
        if (event.type === 'INITIAL_PURCHASE' || event.type === 'RENEWAL') {
            status = SubscriptionStatus.ACTIVE;
            isActive = true;
        } else if (event.type === 'CANCELLATION') {
            status = SubscriptionStatus.CANCELED;
            isActive = false;
        } else if (event.type === 'SUBSCRIPTION_EXPIRED') {
            status = SubscriptionStatus.EXPIRED;
            isActive = false;
        }

        const subscription: UserSubscription = {
            userId,
            subscriberId: subscriber.subscriber_id,
            status,
            plan: planConfig.plan,
            productId,
            originalTransactionId: event.original_transaction_id,
            purchaseDate: event.purchase_date,
            expiresDate: event.expires_date,
            isActive,
            environment: webhookData.environment || 'production',
            store: event.store || 'app_store',
            lastUpdated: Date.now(),
        };

        return subscription;
    } catch (error) {
        console.error("Error parsing subscription data:", error);
        return null;
    }
}

/**
 * 保存用户订阅信息到 KV 存储
 */
async function saveUserSubscription(subscription: UserSubscription): Promise<void> {
    try {
        const subscriptionKey = `subscription_${subscription.userId}`;
        const subscriberKey = `subscriber_${subscription.subscriberId}`;
        
        // 保存到用户订阅记录
        await kv.hset(subscriptionKey, subscription as unknown as Record<string, unknown>);
        
        // 保存到订阅者记录（用于查找）
        await kv.hset(subscriberKey, {
            userId: subscription.userId,
            subscriberId: subscription.subscriberId,
            lastUpdated: subscription.lastUpdated
        });
        
        // 设置过期时间（30天）
        await kv.expire(subscriptionKey, 2592000);
        await kv.expire(subscriberKey, 2592000);
        
        console.log(`✅ Subscription saved for user ${subscription.userId}`);
    } catch (error) {
        console.error("Error saving subscription:", error);
        throw error;
    }
}

/**
 * 重置用户使用计数器
 */
async function resetUserUsageCounters(userId: string): Promise<void> {
    try {
        const usageKey = `usage_${userId}`;
        await kv.hset(usageKey, {
            dailyCount: 0,
            monthlyCount: 0,
            lastReset: Date.now()
        });
        
        console.log(`✅ Usage counters reset for user ${userId}`);
    } catch (error) {
        console.error("Error resetting usage counters:", error);
        throw error;
    }
}

/**
 * 记录订阅事件日志
 */
async function logSubscriptionEvent(userId: string, eventType: string, data: any): Promise<void> {
    try {
        const logKey = `subscription_log_${userId}`;
        const logEntry = {
            eventType,
            data,
            timestamp: Date.now()
        };
        
        // 添加到日志列表
        await kv.lpush(logKey, JSON.stringify(logEntry));
        
        // 限制日志数量（保留最近100条）
        await kv.ltrim(logKey, 0, 99);
        
        console.log(`✅ Event logged: ${eventType} for user ${userId}`);
    } catch (error) {
        console.error("Error logging subscription event:", error);
        // 不抛出错误，日志记录失败不应该影响主要流程
    }
}

/**
 * 处理 AI Points 购买
 */
async function handleAIPointsPurchase(webhookData: any) {
    console.log("💎 Handling AI Points purchase...");
    
    const event = webhookData.event;
    const subscriber = webhookData.subscriber;
    const productId = event?.product_id;
    const userId = webhookData.app_user_id || webhookData.original_app_user_id || subscriber?.original_app_user_id || 'anonymous';
    
    const pointsConfig = AI_POINTS_PRODUCTS[productId as keyof typeof AI_POINTS_PRODUCTS];
    
    if (!pointsConfig) {
        return {
            success: false,
            action: 'invalid_product',
            message: `Invalid AI Points product: ${productId}`
        };
    }
    
    // 添加 AI Points 到用户账户
    await addAIPointsToUser(userId, pointsConfig.totalPoints);
    
    // 记录购买事件
    await logSubscriptionEvent(userId, 'ai_points_purchase', {
        productId,
        points: pointsConfig.points,
        bonus: pointsConfig.bonus,
        totalPoints: pointsConfig.totalPoints,
        purchaseDate: event?.purchase_date,
        transactionId: event?.original_transaction_id
    });
    
    return {
        success: true,
        action: 'ai_points_purchase',
        userId,
        message: `Added ${pointsConfig.totalPoints} AI Points (${pointsConfig.points} + ${pointsConfig.bonus} bonus) to user ${userId}`
    };
}

/**
 * 添加 AI Points 到用户账户
 */
async function addAIPointsToUser(userId: string, points: number): Promise<void> {
    try {
        const pointsKey = `ai_points_${userId}`;
        
        // 获取当前 points
        const currentPoints = await kv.get<number>(pointsKey) || 0;
        
        // 添加新 points
        const newTotal = currentPoints + points;
        await kv.set(pointsKey, newTotal);
        
        // 记录 points 交易历史
        const historyKey = `ai_points_history_${userId}`;
        const historyEntry = {
            type: 'purchase',
            amount: points,
            balance: newTotal,
            timestamp: Date.now()
        };
        
        await kv.lpush(historyKey, JSON.stringify(historyEntry));
        await kv.ltrim(historyKey, 0, 499); // 保留最近500条记录
        
        console.log(`✅ Added ${points} AI Points to user ${userId}. New balance: ${newTotal}`);
    } catch (error) {
        console.error("Error adding AI Points:", error);
        throw error;
    }
}

/**
 * 获取用户 AI Points 余额
 */
async function getUserAIPointsBalance(userId: string): Promise<number> {
    try {
        const pointsKey = `ai_points_${userId}`;
        const balance = await kv.get<number>(pointsKey) || 0;
        return balance;
    } catch (error) {
        console.error("Error getting AI Points balance:", error);
        return 0;
    }
}

/**
 * 扣除用户 AI Points
 */
async function deductUserAIPoints(userId: string, points: number): Promise<boolean> {
    try {
        const pointsKey = `ai_points_${userId}`;
        const currentPoints = await kv.get<number>(pointsKey) || 0;
        
        if (currentPoints < points) {
            console.log(`❌ Insufficient AI Points for user ${userId}. Current: ${currentPoints}, Required: ${points}`);
            return false;
        }
        
        const newTotal = currentPoints - points;
        await kv.set(pointsKey, newTotal);
        
        // 记录 points 交易历史
        const historyKey = `ai_points_history_${userId}`;
        const historyEntry = {
            type: 'deduction',
            amount: -points,
            balance: newTotal,
            timestamp: Date.now()
        };
        
        await kv.lpush(historyKey, JSON.stringify(historyEntry));
        await kv.ltrim(historyKey, 0, 499);
        
        console.log(`✅ Deducted ${points} AI Points from user ${userId}. New balance: ${newTotal}`);
        return true;
    } catch (error) {
        console.error("Error deducting AI Points:", error);
        return false;
    }
}