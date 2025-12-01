import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 诊断配置
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase 配置错误！');
    if (!supabaseUrl) {
        console.error('   ❌ NEXT_PUBLIC_SUPABASE_URL 未设置');
    }
    if (!supabaseServiceKey) {
        console.error('   ❌ SUPABASE_SERVICE_ROLE_KEY 未设置');
    }
    console.error('   请检查环境变量配置');
} else {
    // 验证 key 格式
    const urlValid = supabaseUrl.startsWith('https://') && supabaseUrl.includes('.supabase.co');
    const keyValid = supabaseServiceKey.startsWith('eyJ') && supabaseServiceKey.length > 100;
    
    if (!urlValid) {
        console.error('❌ NEXT_PUBLIC_SUPABASE_URL 格式错误');
        console.error(`   当前值: ${supabaseUrl.substring(0, 30)}...`);
        console.error('   应该是: https://xxxxx.supabase.co');
    }
    
    if (!keyValid) {
        console.error('❌ SUPABASE_SERVICE_ROLE_KEY 格式错误');
        console.error(`   当前值前10字符: ${supabaseServiceKey.substring(0, 10)}...`);
        console.error('   应该以 "eyJ" 开头（JWT token 格式）');
        console.error('   ⚠️ 确保使用的是 service_role key，不是 anon key');
    }
    
    if (urlValid && keyValid) {
        console.log('✅ Supabase 配置检查通过');
        console.log(`   URL: ${supabaseUrl}`);
        console.log(`   Key 前10字符: ${supabaseServiceKey.substring(0, 10)}...`);
    }
}

// 创建 Supabase 客户端（使用 service role key 以获得完整权限）
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
