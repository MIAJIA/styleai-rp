export enum AppStep {
    UPLOAD = 'UPLOAD',
    COLLAGE = 'COLLAGE',
    TRY_ON = 'TRY_ON',
}

export interface UploadedImage {
    id: string;
    file: File;
    previewUrl: string;
    base64: string;
}

export interface SceneOption {
    id: string;
    label: string;
    promptFragment: string;
}

export interface ModelOption {
    id: string;
    label: string;
    promptFragment: string;
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16';

// 数据库 style_templates 表对应的类型
export interface StyleTemplate {
    id: string; // UUID
    name: string; // VARCHAR(100) NOT NULL
    urls: string; // TEXT NOT NULL (JSON 字符串，包含所有图片URL)
    post: string; // TEXT NOT NULL
    prompt: string; // TEXT NOT NULL
    order: number; // INTEGER DEFAULT 0
    created_at: string; // TIMESTAMPTZ
}

// Look 接口（用于前端显示，基于数据库数据）
export interface Look {
    id: string;
    name: string;
    status: 'draft' | 'completed';
    updatedAt: number;

    // Workflow State
    step: AppStep;
    uploadedImages: UploadedImage[];
    collageImage: string | null;

    selectedModel: string;
    customModelPrompt?: string; // New field for custom model description

    selectedScene: string;
    customScenePrompt?: string; // New field for custom scene description

    lookImage: string | null;

    // 数据库字段
    urls?: string; // 对应数据库的 urls 字段
    post?: string; // 对应数据库的 post 字段
    prompt?: string; // 对应数据库的 prompt 字段
    order?: number; // 对应数据库的 order 字段
}

// 数据库 for_you 表对应的类型
export interface ForYou {
    id: string; // UUID
    name: string; // VARCHAR(100) NOT NULL UNIQUE
    url: string; // TEXT NOT NULL
    created_at: string; // TIMESTAMPTZ
    updated_at: string; // TIMESTAMPTZ
}

// Lookbook 接口（用于前端显示，基于数据库数据）
export interface Lookbook {
    id: string;
    name: string; // 对应数据库的 name 字段
    url: string; // 对应数据库的 url 字段
    createdAt: number; // 从 created_at 转换而来
    updatedAt: number; // 从 updated_at 转换而来
    looks: Look[]; // Looks 数据需要单独存储或从其他地方加载
    state?: number; // 状态：0=下架，1=上线，2=已删除
    order?: number; // 排序
}


export const CUSTOM_MODEL_ID = 'custom_model';
export const CUSTOM_SCENE_ID = 'custom_scene';

export const MODELS: ModelOption[] = [
    { id: 'asian_female', label: 'Asian Female Model', promptFragment: 'a stylish young Asian female model' },
    { id: 'caucasian_female', label: 'Caucasian Female Model', promptFragment: 'a sophisticated Caucasian female model' },
    { id: 'black_female', label: 'Black Female Model', promptFragment: 'a chic Black female model' },
    { id: 'latina_female', label: 'Latina Female Model', promptFragment: 'a trendy Latina female model' },
    { id: 'asian_male', label: 'Asian Male Model', promptFragment: 'a cool Asian male model' },
    { id: 'caucasian_male', label: 'Caucasian Male Model', promptFragment: 'a modern Caucasian male model' },
];

export const SCENES: SceneOption[] = [
    { id: 'studio_grey', label: 'Minimalist Grey Studio', promptFragment: 'minimalist grey studio background with soft professional lighting' },
    { id: 'street_paris', label: 'Parisian Street', promptFragment: 'cobblestone street in Paris on a sunny afternoon, blurred background' },
    { id: 'rooftop_nyc', label: 'NYC Rooftop', promptFragment: 'modern New York City rooftop at golden hour with skyline in background' },
    { id: 'abstract_neon', label: 'Abstract Neon', promptFragment: 'abstract artistic background with neon light accents and shadows' },
    { id: 'nature_field', label: 'Open Field', promptFragment: 'natural open field with tall grass and soft sunlight' },
];

export const PLACEHOLDER_IMAGE = 'https://picsum.photos/800/600';