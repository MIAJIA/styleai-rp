"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Resource } from '@/lib/types/resources';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

const RESOURCE_TYPES = ['上衣', '裤裙', '鞋', '包包'] as const;
type ResourceType = typeof RESOURCE_TYPES[number];

interface ResourceFormData {
    name: string;
    type: ResourceType;
    url: string;
    shopurl: string;
}

export default function ResourceManagementPage() {
    const router = useRouter();
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchName, setSearchName] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [editingResource, setEditingResource] = useState<Resource | null>(null);
    const [formData, setFormData] = useState<ResourceFormData>({
        name: '',
        type: '上衣',
        url: '',
        shopurl: '',
    });
    const [urlInput, setUrlInput] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    // 加载资源列表
    const loadResources = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterType !== 'all') {
                params.append('type', filterType);
            }

            const response = await fetch(`/api/apple/web/resources?${params.toString()}`);
            const result = await response.json();

            if (result.success) {
                let filtered = result.data;
                // 客户端按名称过滤
                if (searchName.trim()) {
                    filtered = filtered.filter((r: Resource) =>
                        r.name.toLowerCase().includes(searchName.toLowerCase())
                    );
                }
                setResources(filtered);
            }
        } catch (error) {
            console.error('Failed to load resources:', error);
        } finally {
            setLoading(false);
        }
    }, [filterType, searchName]);

    useEffect(() => {
        loadResources();
    }, [loadResources]);

    // 处理文件上传
    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        setUploadError('');

        try {
            // 上传到 blob storage
            const arrayBuffer = await file.arrayBuffer();

            const uploadResponse = await fetch('/api/apple/upload', {
                method: 'POST',
                headers: {
                    'file-name': file.name,
                    'content-type': file.type,
                    'user-id': 'resource-manager',
                },
                body: arrayBuffer,
            });

            if (!uploadResponse.ok) {
                throw new Error('Upload failed');
            }

            const uploadResult = await uploadResponse.json();
            const imageUrl = uploadResult.blobUrl || uploadResult.url || uploadResult.data?.url;

            if (!imageUrl) {
                throw new Error('No URL returned from upload');
            }

            // 设置表单数据
            setFormData(prev => ({
                ...prev,
                url: imageUrl,
                name: file.name.replace(/\.[^/.]+$/, ''), // 移除扩展名作为默认名称
            }));
            setIsUploading(false);
        } catch (error: any) {
            console.error('Upload error:', error);
            setUploadError(error.message || '上传失败');
            setIsUploading(false);
        }
    };

    // 处理拖拽上传
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    // 处理文件选择
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFileUpload(files[0]);
        }
    };

    // 处理URL上传
    const handleUrlUpload = async () => {
        if (!urlInput.trim()) return;
        setIsUploading(true);
        setUploadError('');

        try {
            // 尝试从URL获取图片
            const response = await fetch(urlInput);
            if (!response.ok) throw new Error(`连接失败: ${response.statusText}`);

            const contentType = response.headers.get('content-type');
            let blob: Blob;

            // 如果是HTML，尝试提取og:image
            if (contentType && contentType.includes('text/html')) {
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                    doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');

                if (ogImage) {
                    const imgUrl = new URL(ogImage, urlInput).toString();
                    const imgResponse = await fetch(imgUrl);
                    blob = await imgResponse.blob();
                } else {
                    throw new Error('无法从页面中找到图片。请使用直接的图片链接。');
                }
            } else {
                blob = await response.blob();
            }

            if (!blob || !blob.type.startsWith('image/')) {
                throw new Error('URL 返回的不是有效的图片文件');
            }

            // 上传到 blob storage
            const file = new File([blob], `${Date.now()}.jpg`, { type: blob.type });
            const arrayBuffer = await file.arrayBuffer();

            const uploadResponse = await fetch('/api/apple/upload', {
                method: 'POST',
                headers: {
                    'file-name': file.name,
                    'content-type': file.type,
                    'user-id': 'resource-manager',
                },
                body: arrayBuffer,
            });

            if (!uploadResponse.ok) {
                throw new Error('上传失败');
            }

            const uploadResult = await uploadResponse.json();
            const imageUrl = uploadResult.blobUrl || uploadResult.url || uploadResult.data?.url;

            if (!imageUrl) {
                throw new Error('上传后未返回URL');
            }

            setFormData(prev => ({
                ...prev,
                url: imageUrl,
            }));
            setUrlInput('');
            setIsUploading(false);
        } catch (error: any) {
            console.error('URL upload error:', error);
            setUploadError(error.message || '上传失败');
            setIsUploading(false);
        }
    };

    // 保存资源
    const handleSave = async () => {
        if (!formData.name || !formData.url) {
            alert('请填写名称和图片URL');
            return;
        }

        try {
            const payload = {
                name: formData.name,
                type: formData.type,
                url: formData.url,
                shopurl: formData.shopurl || null,
            };

            let response;
            if (editingResource) {
                // 更新
                response = await fetch('/api/apple/web/resources', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingResource.id, ...payload }),
                });
            } else {
                // 创建
                response = await fetch('/api/apple/web/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }

            const result = await response.json();
            if (result.success) {
                setFormData({ name: '', type: '上衣', url: '', shopurl: '' });
                setEditingResource(null);
                setShowAddForm(false);
                loadResources();
            } else {
                alert(result.error || '保存失败');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('保存失败');
        }
    };

    // 编辑资源
    const handleEdit = (resource: Resource) => {
        setEditingResource(resource);
        setShowAddForm(true);
        setFormData({
            name: resource.name,
            type: resource.type as ResourceType,
            url: resource.url,
            shopurl: resource.shopurl || '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 取消编辑/添加
    const handleCancel = () => {
        setEditingResource(null);
        setShowAddForm(false);
        setFormData({ name: '', type: '上衣', url: '', shopurl: '' });
        setUrlInput('');
        setUploadError('');
    };

    // 删除资源
    const handleDelete = async (id: number) => {
        if (!confirm('确定要删除这个资源吗？')) return;

        try {
            const response = await fetch(`/api/apple/web/resources?id=${id}`, {
                method: 'DELETE',
            });
            const result = await response.json();
            if (result.success) {
                loadResources();
            } else {
                alert(result.error || '删除失败');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('删除失败');
        }
    };

    return (
        <div className="min-h-screen bg-white text-gray-900">
            <header className="border-b border-gray-200 bg-white sticky top-0 z-30">
                <div className="mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => router.push('/gemini')} 
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </button>
                        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">S</div>
                        <span className="font-semibold text-lg tracking-tight text-gray-900">StyleForge AI</span>
                    </div>
                </div>
            </header>
            <div className="mx-auto px-4 mt-4">
                {/* 头部 */}
                <div className="flex items-center">
                    <h1 className="text-2xl font-bold mb-1 text-gray-900">资源管理</h1>
                    <p className="text-gray-600 text-sm">管理时尚资源：上传、编辑和分类</p>

                </div>


                {/* 搜索和类型筛选 */}
                <div className="">
                <button
                        onClick={() => {
                            setEditingResource(null);
                            setFormData({ name: '', type: '上衣', url: '', shopurl: '' });
                            setUrlInput('');
                            setUploadError('');
                            setShowAddForm(true);
                        }}
                        className="absolute left-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        添加新资源
                    </button>
                    {/* 搜索框 */}
                    <div className="flex justify-center">
                        <input
                            type="text"
                            placeholder="搜索资源名称..."
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="w-full max-w-md bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    {/* 类型筛选按钮 */}
                    <div className="flex flex-wrap gap-2 justify-center my-2">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === 'all'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            全部
                        </button>
                        {RESOURCE_TYPES.map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === type
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 资源列表 */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h2 className="text-lg font-semibold mb-3 text-gray-900">资源列表 ({resources.length})</h2>
                    {loading ? (
                        <div className="text-center py-8 text-gray-500 text-sm">加载中...</div>
                    ) : resources.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">暂无资源</div>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {resources.map(resource => (
                                <div
                                    key={resource.id}
                                    className=" break-inside-avoid mb-3 bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-indigo-300 transition-all group shadow-sm"
                                >
                                    <div className="bg-gray-50 relative">
                                        <img
                                            src={resource.url}
                                            alt={resource.name}
                                            className="w-[200px] h-[300px] object-cover"
                                            loading="lazy"
                                        />
                                        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                                            <button
                                                onClick={() => handleEdit(resource)}
                                                className="p-1 bg-white/90 hover:bg-indigo-50 text-indigo-600 rounded-md shadow-sm"
                                                title="编辑"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(resource.id)}
                                                className="p-1 bg-white/90 hover:bg-red-50 text-red-600 rounded-md shadow-sm"
                                                title="删除"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        <h3 className="text-gray-900 text-xs font-medium truncate mb-1">{resource.name}</h3>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] px-1 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                                                {resource.type}
                                            </span>
                                            {resource.shopurl && (
                                                <a
                                                    href={resource.shopurl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[9px] text-indigo-600 hover:text-indigo-700"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    购买
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>


            {/* 弹窗表单 */}
            <Dialog open={showAddForm || !!editingResource} onOpenChange={(open) => {
                if (!open) {
                    handleCancel();
                }
            }}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white border-gray-200 text-gray-900 [&>button]:text-gray-400 [&>button]:hover:text-gray-900">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            {editingResource ? '编辑资源' : '添加新资源'}
                        </DialogTitle>
                    </DialogHeader>

                    {/* 拖拽上传区域 */}
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        className="border-2 border-dashed border-gray-300 hover:border-indigo-400 rounded-lg p-4 mb-3 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-gray-50 group"
                    >
                        <div className="w-12 h-12 mb-3 bg-gray-200 group-hover:bg-indigo-100 rounded-full flex items-center justify-center text-gray-500 group-hover:text-indigo-600 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">拖拽图片到这里</h3>
                        <p className="text-gray-500 mb-3 text-xs">或点击下方按钮选择文件</p>
                        <label className="px-3 py-1.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition cursor-pointer text-xs">
                            选择文件
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                                disabled={isUploading}
                            />
                        </label>
                        {isUploading && (
                            <div className="mt-4 flex items-center gap-2 text-gray-600">
                                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                <span>上传中...</span>
                            </div>
                        )}
                        {uploadError && (
                            <div className="mt-4 text-red-600 text-sm">{uploadError}</div>
                        )}
                    </div>

                    {/* URL上传 */}
                    <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-px bg-gray-300 flex-1"></div>
                            <span className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">或从URL导入</span>
                            <div className="h-px bg-gray-300 flex-1"></div>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder="粘贴图片URL或商品页面URL..."
                                className="flex-1 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                                onKeyDown={(e) => e.key === 'Enter' && handleUrlUpload()}
                                disabled={isUploading}
                            />
                            <button
                                onClick={handleUrlUpload}
                                disabled={isUploading || !urlInput}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg disabled:opacity-50 transition-colors"
                            >
                                {isUploading ? '导入中...' : '导入'}
                            </button>
                        </div>
                    </div>

                    {/* 表单 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">资源名称 *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500"
                                placeholder="输入资源名称"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">类型 *</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as ResourceType })}
                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500"
                            >
                                {RESOURCE_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">图片URL *</label>
                            <input
                                type="text"
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500"
                                placeholder="图片URL（上传后自动填充）"
                            />
                            {formData.url && (
                                <div className="mt-2">
                                    <img src={formData.url} alt="Preview" className="max-w-xs h-24 object-cover rounded-lg border border-gray-300" />
                                </div>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">购买链接（可选）</label>
                            <input
                                type="text"
                                value={formData.shopurl}
                                onChange={(e) => setFormData({ ...formData, shopurl: e.target.value })}
                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500"
                                placeholder="https://shop.example.com/product/1"
                            />
                        </div>
                    </div>

                    {/* 操作按钮 */}
                    <DialogFooter className="mt-4">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!formData.name || !formData.url}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                        >
                            {editingResource ? '更新' : '保存'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
