import { NextRequest, NextResponse } from "next/server";
import { kv } from '@vercel/kv';
import { supabase } from '@/lib/supabase';

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
    SUBSCRIBER_ALIAS = 'SUBSCRIBER_ALIAS',
    EXPIRATION = "EXPIRATION",//订阅过期订阅过期
    TEST = 'TEST' // 测试事件
}

// https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
interface RevenueCatWebhookData {
    api_version: string;
    event: {
        type: string;//事件类型
        id: string; //事件ID
        app_id: string; //应用ID
        event_timestamp_ms: number;//事件时间戳
        
        app_user_id: string;//用户ID
        original_app_user_id: string; //原始用户ID
        aliases: string[];//别名：订阅者曾经使用过的所有应用用户 ID
        
        // 订阅事件字段
        product_id: string; //产品ID
        entitlement_ids: string[];//权益ID
        entitlement_id: string | null;//已抛弃
        period_type: string;//交易类型
        grace_period_expiration_at_ms: number | null;//宽限期到期时间
        expiration_at_ms: number;//订阅过期时间
        store: string;//商店
        environment: string;//环境
        cancel_reason: string | null;//取消原因
        expiration_reason: string | null;//过期原因
        new_product_id: string | null;//新产品ID
        presented_offering_id: string | null;//展示的套餐ID
        price: number | null;//价格
        currency: string | null;//货币
        price_in_purchased_currency: number | null;//购买货币价格
        tax_percentage: number | null;//税率
        commission_percentage: number | null;//佣金比例
        takehome_percentage: number | null;//已抛弃
        transaction_id: string | null;//原始交易ID
        is_family_share: boolean | null;//是否是家庭共享
        transferred_from: string[] | null;//TRANSFER 时，此字段才可用
        transferred_to: string[] | null;//TRANSFER 时，此字段才可用
        country_code: string;//国家代码
        renewal_number: number | null;//续订次数

        metadata: Record<string, unknown> | null;
        offer_code: string | null;
        original_transaction_id: string | null;
        purchased_at_ms: number;

        subscriber_attributes: Record<string, unknown>;

    };

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
        const body: RevenueCatWebhookData = await request.json();
        kv.lpush('webhook_log', JSON.stringify(body));

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
            console.log("API Version:", body.api_version);
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
            // processed: processResult
        });

    } catch (error) {
        console.error("Webhook processing error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

async function getUserId(webhookData: RevenueCatWebhookData) {
    const userId = webhookData.event.original_app_user_id;
    console.log("userId:", userId);
    const id = await kv.get(`${userId}`);
    console.log("id:", id);
    if (id) {
        return id;
    }
    const data = await supabase.from('payments').select('user_id').eq('revenuecat_customer_id', userId).limit(1).single();
    if (data.error) {
        console.error("Error getting user ID:", data.error);
        throw new Error("Error getting user ID:" + data.error.message);
    }
    kv.set(`${userId}`, data.data?.user_id);
    return data.data?.user_id;
}

/**
 * 处理订阅事件的核心函数
 */
async function processSubscriptionEvent(webhookData: RevenueCatWebhookData) {

    console.log("🔄 Processing subscription event...");

    switch (webhookData.event.type) {
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

        case EventType.TEST://测试事件
            return await handleTestEvent(webhookData);
        case EventType.EXPIRATION://订阅过期
            return await handleSubscriptionExpired(webhookData);
        default:
            console.log(`⚠️ Unhandled event type: ${webhookData.event.type}`);
    }

}

/**
 * 处理首次购买事件
 */
async function handleInitialPurchase(webhookData: RevenueCatWebhookData) {
    console.log("🛒 Handling initial purchase...");
    const paymentId = webhookData.event.transaction_id;
    const monthlyCredits = 1000; // 每月1000积分
    const userId = await getUserId(webhookData);
    // 立即发放第一个月的积分
    await supabase.rpc('add_credits', {
        p_user_id: userId,
        p_amount: monthlyCredits,
        p_transaction_type: 'subscription_monthly',
        p_payment_id: paymentId,
        p_description: `Initial subscription credits - ${monthlyCredits} credits`
    });

    // 设置月度积分重置日期（30天后）
    const nextResetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await supabase
        .from('user_credits')
        .update({
            subscription_credits_monthly: monthlyCredits,
            subscription_credits_used: 0,
            subscription_credits_reset_date: nextResetDate.toISOString(),
        })
        .eq('user_id', userId);
        supabase.from('action_history').insert({
            user_id: userId,
            action:  `Webhook: ${webhookData.event.type}`,
        }).select().single();
}

/**
 * 处理续费事件
 */
async function handleRenewal(webhookData: any) {
    console.log("🔄 Handling renewal...");
    const userId = await getUserId(webhookData);
    const { data: user_credits } = await supabase.from('user_credits').select('subscription_credits_monthly,subscription_credits_used').eq('user_id', userId).single();
    console.log("user_credits:", user_credits);
    supabase.from('action_history').insert({
        user_id: userId,
        action:  `Webhook: ${webhookData.event.type}`,
    }).select().single();
    // 1. 扣除用户剩余积分
    if (user_credits?.subscription_credits_monthly > 0 && 1000 - (user_credits?.subscription_credits_used || 0) > 0) {
        const result = await supabase.rpc('use_credits', {
            p_user_id: userId,
            p_amount: 1000 - (user_credits?.subscription_credits_used || 0),
            p_related_entity_type: 'subscription_monthly',
            p_related_entity_id: null,
            p_description: `Subscription cancel credits - ${1000 - user_credits?.subscription_credits_used} credits`
        });
        if (result.error) {
            console.error("Error using credits:", result.error);
            throw new Error("Error using credits:" + result.error.message);
        }
    }
    // 2. 更新用户积分使用情况
    const result = await supabase.from('user_credits').update({
        subscription_credits_monthly: 1000,
        subscription_credits_used: 0,
        subscription_credits_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('user_id', userId);
    if (result.error) {
        console.error("Error using credits:", result.error);
        throw new Error("Error using credits:" + result.error.message);
    }
    // 3. 发放1000积分
    const result1 = await supabase.rpc('add_credits', {
        p_user_id: userId,
        p_amount: 1000,
        p_transaction_type: 'subscription_monthly',
        p_payment_id: webhookData.event.transaction_id,
        p_description: `Subscription renewal credits - ${1000} credits`
    });
    if (result1.error) {
        console.error("Error using credits:", result1.error);
        throw new Error("Error using credits:" + result1.error.message);
    }

}

/**
 * 处理取消订阅事件
 */
async function handleCancellation(webhookData: any) {
    console.log("❌ Handling cancellation...");
    // const userId = await getUserId(webhookData);
    // const result = await supabase.rpc('cancel_subscription_credits', {
    //     p_user_id: userId,
    // });
    // if (result.error) {
    //     console.error("Error canceling subscription credits:", result.error);
    //     throw new Error("Error canceling subscription credits:" + result.error.message);
    // }
    // return result.data;
    const userId = await getUserId(webhookData);
    supabase.from('action_history').insert({
        user_id: userId,
        action:  `Webhook: ${webhookData.event.type} - ${webhookData.event.cancel_reason}`,
    }).select().single();

    if (webhookData.event.cancel_reason === "CUSTOMER_SUPPORT") {
        handleSubscriptionExpired(webhookData);
    }
}

/**
 * 处理恢复订阅事件
 */
async function handleUncancellation(webhookData: any) {
    console.log("✅ Handling uncancellation...");
    const userId = await getUserId(webhookData);
    supabase.from('action_history').insert({
        user_id: userId,
        action:  `Webhook: ${webhookData.event.type}`,
    }).select().single();
}

/**
 * 处理订阅过期事件
 */
async function handleSubscriptionExpired(webhookData: any) {
    console.log("⏰ Handling subscription expiration...");
    const userId = await getUserId(webhookData);
    const { data: user_credits } = await supabase.from('user_credits').select('subscription_credits_monthly,subscription_credits_used').eq('user_id', userId).single();
    console.log("user_credits:", user_credits);

    // 是否还有积分
    if (user_credits?.subscription_credits_monthly > 0) {
        // 是否还有剩余积分
        if (1000 - (user_credits?.subscription_credits_used || 0) > 0) {
            // 扣除剩余积分
            const result = await supabase.rpc('cancel_subscription_credits', {
                p_user_id: userId,
            });
            if (result.error) {
                console.error("Error using credits:", result.error);
                throw new Error("Error using credits:" + result.error.message);
            }
        }
        await supabase.from('user_credits').update({
            subscription_credits_monthly: 0,
            subscription_credits_used: 0,
            subscription_credits_reset_date: null,
        }).eq('user_id', userId);
    }

    supabase.from('action_history').insert({
        user_id: userId,
        action:  `Webhook: ${webhookData.event.type}`,
    }).select().single();
    
}

/**
 * 处理账单问题事件
 */
async function handleBillingIssue(webhookData: any) {
    console.log("💳 Handling billing issue...");
        supabase.from('action_history').insert({
        user_id: await getUserId(webhookData),
        action:  `Webhook: ${webhookData.event.type}`,
    }).select().single();

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
    supabase.from('action_history').insert({
        user_id: await getUserId(webhookData),
        action:  `Webhook: ${webhookData.event.type}`,
    }).select().single();

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
    supabase.from('action_history').insert({
        user_id: await getUserId(webhookData),
        action:  `Webhook: ${webhookData.event.type}`,
    }).select().single();

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
 * 处理测试事件
 * TEST 事件是 RevenueCat 发送的测试 webhook，通常用于验证 webhook 配置
 */
async function handleTestEvent(webhookData: any) {
    console.log("🧪 Handling TEST event...");

    const event = webhookData.event;
    const userId = webhookData.app_user_id || event?.app_user_id || 'test_user';
    const productId = event?.product_id;

    // 记录测试事件
    console.log("TEST Event Details:", {
        userId,
        productId,
        environment: event?.environment,
        store: event?.store,
        expirationAt: event?.expiration_at_ms,
        subscriberAttributes: event?.subscriber_attributes
    });

    // 如果是测试产品，可以创建一个测试订阅记录
    if (productId && SUBSCRIPTION_PLANS[productId as keyof typeof SUBSCRIPTION_PLANS]) {
        const subscription = await parseTestSubscriptionData(webhookData);
        if (subscription) {
            await saveUserSubscription(subscription);

            await logSubscriptionEvent(userId, 'test_purchase', {
                productId,
                plan: subscription.plan,
                purchaseDate: subscription.purchaseDate,
                expiresDate: subscription.expiresDate
            });

            return {
                success: true,
                action: 'test_purchase',
                userId: subscription.userId,
                subscriptionStatus: subscription.status,
                message: `Test purchase processed for ${subscription.plan} plan`
            };
        }
    }

    // 对于非订阅产品的测试事件，仅记录日志
    await logSubscriptionEvent(userId, 'test_event', {
        productId,
        eventId: event?.id,
        environment: event?.environment,
        store: event?.store
    });

    return {
        success: true,
        action: 'test_event',
        userId,
        message: `Test event received and logged for product ${productId || 'unknown'}`
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
 * 解析测试订阅数据（针对 TEST 事件）
 * TEST 事件的数据结构与标准事件不同，需要特殊处理
 */
async function parseTestSubscriptionData(webhookData: any): Promise<UserSubscription | null> {
    try {
        const event = webhookData.event;

        if (!event) {
            console.error("Missing event data in test event");
            return null;
        }

        // TEST 事件可能没有 subscriber 对象，使用 app_user_id
        const userId = webhookData.app_user_id || event.app_user_id || event.original_app_user_id || 'test_user';
        const productId = event.product_id;
        const planConfig = SUBSCRIPTION_PLANS[productId as keyof typeof SUBSCRIPTION_PLANS];

        if (!planConfig) {
            console.error(`Unknown product ID: ${productId}`);
            return null;
        }

        // 从时间戳转换为 ISO 字符串
        const purchaseDate = event.purchased_at_ms ? new Date(event.purchased_at_ms).toISOString() : new Date().toISOString();
        const expiresDate = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;

        const subscription: UserSubscription = {
            userId,
            subscriberId: userId, // TEST 事件可能没有 subscriber_id，使用 userId
            status: SubscriptionStatus.TRIAL,
            plan: planConfig.plan,
            productId,
            originalTransactionId: event.original_transaction_id || event.id,
            purchaseDate,
            expiresDate,
            isActive: true, // TEST 事件通常表示有效订阅
            environment: webhookData.environment || event.environment || 'sandbox',
            store: event.store || 'app_store',
            lastUpdated: Date.now(),
        };

        return subscription;
    } catch (error) {
        console.error("Error parsing test subscription data:", error);
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
