/**
 * 随机头像生成工具
 * 使用 Dicebear API 生成简单的用户头像
 */

export interface AvatarOptions {
  seed?: string;
  size?: number;
  backgroundColor?: string;
  radius?: number;
  style?: 'adventurer' | 'adventurer-neutral' | 'avataaars' | 'big-ears' | 'big-ears-neutral' | 'big-smile' | 'bottts' | 'croodles' | 'croodles-neutral' | 'identicon' | 'initials' | 'micah' | 'miniavs' | 'personas' | 'pixel-art' | 'pixel-art-neutral' | 'rings' | 'shapes' | 'thumbs';
}

/**
 * 生成随机头像URL
 * @param options 头像选项
 * @returns 头像URL
 */
export function generateAvatarUrl(options: AvatarOptions = {}): string {
  const {
    seed = generateRandomSeed(),
    size = 128,
    backgroundColor = 'b6e3f4',
    radius = 50,
    style = 'avataaars'
  } = options;

  const baseUrl = 'https://api.dicebear.com/7.x';
  const params = new URLSearchParams({
    seed,
    size: size.toString(),
    backgroundColor,
    radius: radius.toString(),
  });

  return `${baseUrl}/${style}/svg?${params.toString()}`;
}

/**
 * 根据用户名生成头像URL
 * @param name 用户名
 * @param options 头像选项
 * @returns 头像URL
 */
export function generateAvatarFromName(name: string, options: AvatarOptions = {}): string {
  const seed = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return generateAvatarUrl({ ...options, seed });
}

/**
 * 生成随机种子字符串
 * @returns 随机种子
 */
function generateRandomSeed(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 获取预设的头像样式
 */
export const AVATAR_STYLES = {
  CUTE: 'avataaars',
  MINIMAL: 'initials',
  PIXEL: 'pixel-art',
  GEOMETRIC: 'shapes',
  RINGS: 'rings',
  THUMBS: 'thumbs',
  PERSONAS: 'personas',
  MICAH: 'micah'
} as const;

/**
 * 生成默认头像URL（用于游客用户）
 * @returns 默认头像URL
 */
export function generateDefaultAvatarUrl(): string {
  return generateAvatarUrl({
    style: 'avataaars',
    backgroundColor: 'f0f0f0',
    size: 128
  });
}

/**
 * 生成游客头像URL
 * @param guestId 游客ID
 * @returns 游客头像URL
 */
export function generateGuestAvatarUrl(guestId: string): string {
  return generateAvatarFromName(guestId, {
    style: 'avataaars',
    backgroundColor: 'e8f4fd',
    size: 128
  });
} 