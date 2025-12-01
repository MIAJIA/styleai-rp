"use client";

import React, { useState, useEffect } from 'react';
import { LookEditor } from '@/components/LookEditor';
import { useRouter, useSearchParams } from 'next/navigation';
import { Look, AppStep, MODELS, SCENES } from '../../type';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// 资源类型
type ResourceType = '上衣' | '裤子' | '鞋' | '包包' | '配饰' | '其他';
const RESOURCE_TYPES: ResourceType[] = ['上衣', '裤子', '鞋', '包包', '配饰', '其他'];

interface Resource {
  id: string;
  name: string;
  type: string;
  url: string;
  shopurl?: string;
}

const prompt='Generate a photorealistic full-body fashion photograph of wearing the outfit shown in the reference image. The lighting should be cinematic and high-end fashion editorial style. Ensure the clothing looks exactly like the reference.'
const App: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeLookbookName = searchParams.get('name');
  const lookId = searchParams.get('lookId');

  // 初始化空 Look
  const createEmptyLook = (): Look => ({
    id: lookId || crypto.randomUUID(),
    name: activeLookbookName || '',
    status: 'draft',
    updatedAt: Date.now(),
    step: AppStep.UPLOAD,
    uploadedImages: [],
    collageImage: null,
    lookImage: null,
    selectedModel: MODELS[0].id,
    selectedScene: SCENES[0].id,
    order: 0
  });

  const [look, setLook] = useState<Look>(createEmptyLook());
  const [isLoading, setIsLoading] = useState(!!lookId); // 只有有 lookId 时才需要加载

  // 资源管理状态
  const [showResourceDialog, setShowResourceDialog] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [formData, setFormData] = useState({ name: '', type: '上衣' as ResourceType, url: '', shopurl: '' });
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // 加载 Look 数据
  useEffect(() => {
    const loadLook = async () => {
      // 没有 lookId 表示新建，使用空 Look
      if (!lookId) {
        setIsLoading(false);
        return;
      }
      if (!activeLookbookName) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/apple/web/style-templates?name=${encodeURIComponent(activeLookbookName)}`);
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
          const foundLook = result.data.find((item: any) => item.id === lookId);
          if (foundLook) {
            // 转换数据库格式为 Look
            let postData: any = {};
            try {
              if (foundLook.post && typeof foundLook.post === 'string') {
                const trimmed = foundLook.post.trim();
                if (trimmed.startsWith('{')) {
                  postData = JSON.parse(foundLook.post);
                }
              }
            } catch {}

            setLook({
              id: foundLook.id,
              name: foundLook.name,
              status: postData.status || 'draft',
              updatedAt: postData.updatedAt || Date.now(),
              step: postData.step || AppStep.UPLOAD,
              uploadedImages: [],
              collageImage: null,
              lookImage: null,
              selectedModel: postData.selectedModel || MODELS[0].id,
              customModelPrompt: postData.customModelPrompt,
              selectedScene: postData.selectedScene || SCENES[0].id,
              customScenePrompt: postData.customScenePrompt,
              urls: foundLook.urls,
              post: foundLook.post,
              prompt: foundLook.prompt,
              order: foundLook.order || 0
            });
          }
        }
      } catch (error) {
        console.error('Error loading look:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLook();
  }, [lookId, activeLookbookName]);

  // 更新 Look（先更新本地状态，再异步保存到服务器）
  const handleUpdate = (updatedLook: Look) => {
    // 立即更新本地状态
    setLook(updatedLook);
  };

  // 资源管理函数
  const handleResourceCancel = () => {
    setShowResourceDialog(false);
    setEditingResource(null);
    setFormData({ name: '', type: '上衣', url: '', shopurl: '' });
    setUrlInput('');
    setUploadError('');
  };

  const handleResourceSave = async () => {
    if (!formData.name || !formData.url) {
      setUploadError('请填写名称和图片URL');
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
        response = await fetch('/api/apple/web/resources', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingResource.id, ...payload }),
        });
      } else {
        response = await fetch('/api/apple/web/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json();
      if (result.success) {
        handleResourceCancel();
        // 通知 LookEditor 刷新资源列表
        window.dispatchEvent(new CustomEvent('resourceUpdated'));
      } else {
        setUploadError(result.error || '保存失败');
      }
    } catch (error) {
      console.error('Save error:', error);
      setUploadError('保存失败');
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await uploadFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError('');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const response = await fetch('/api/apple/upload', {
        method: 'POST',
        headers: {
          'file-name': file.name,
          'content-type': file.type,
          'user-id': 'resource-manager',
        },
        body: arrayBuffer,
      });
      const result = await response.json();
      const imageUrl = result.blobUrl || result.url || result.data?.url;
      if (imageUrl) {
        setFormData(prev => ({ 
          ...prev, 
          url: imageUrl,
          name: prev.name || file.name.replace(/\.[^/.]+$/, ''),
        }));
      } else {
        setUploadError('上传失败');
      }
    } catch (error) {
      setUploadError('上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) return;
    setIsUploading(true);
    setUploadError('');

    try {
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
          throw new Error('无法从页面中找到图片');
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

      const uploadResult = await uploadResponse.json();
      const imageUrl = uploadResult.blobUrl || uploadResult.url || uploadResult.data?.url;

      if (imageUrl) {
        setFormData(prev => ({ ...prev, url: imageUrl }));
        setUrlInput('');
      } else {
        setUploadError('上传失败');
      }
    } catch (error: any) {
      setUploadError(error.message || '导入失败');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-indigo-600">Loading...</div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-white text-gray-900">
      <LookEditor
        look={look}
        lookbookTitle={activeLookbookName || ''}
        onUpdate={handleUpdate}
        onBack={() => router.push(`/gemini/lookbook?name=${encodeURIComponent(activeLookbookName || '')}`)}
        onAddResource={() => setShowResourceDialog(true)}
      />

      {/* 资源管理弹窗 */}
      <Dialog open={showResourceDialog || !!editingResource} onOpenChange={(open) => {
        if (!open) handleResourceCancel();
      }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white border-gray-200 text-gray-900 [&>button]:text-gray-400 [&>button]:hover:text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {editingResource ? '编辑资源' : '添加新资源'}
            </DialogTitle>
          </DialogHeader>

          {/* 拖拽上传区域 */}
          <div
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
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
                placeholder="粘贴图片URL..."
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
              onClick={handleResourceCancel}
              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleResourceSave}
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
};

export default App;
