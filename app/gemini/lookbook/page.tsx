"use client";

import React, { useState, useEffect } from 'react';
import { MODELS, SCENES, AppStep, Look, Lookbook, CUSTOM_MODEL_ID, CUSTOM_SCENE_ID, UploadedImage } from '../type';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// 扩展 Window 接口以支持 aistudio
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const App: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Global State
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [currentLookbook, setCurrentLookbook] = useState<Lookbook | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Navigation State - 从路由参数获取 name
  const activeLookbookName = searchParams.get('name');
  console.log('activeLookbookName', activeLookbookName);
  // UI State for Look action modal
  const [isLookActionModalOpen, setIsLookActionModalOpen] = useState(false);
  const [selectedLook, setSelectedLook] = useState<Look | null>(null);

  // 编辑 Prompt 对话框状态
  const [isEditPromptModalOpen, setIsEditPromptModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<string>('');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // 排序模式状态
  const [isSortMode, setIsSortMode] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // 筛选状态
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'draft'>('all');

  // Helper: 将 Look 转换为数据库格式
  const lookToDbFormat = (look: Look) => {
    const imageUrls = {
      uploadedImages: look.uploadedImages.map(img => ({
        id: img.id,
        previewUrl: img.previewUrl,
        base64: img.base64 ? (img.base64.length > 100 ? img.base64.substring(0, 100) + '...' : img.base64) : ''
      })),
      collageImage: look.collageImage,
      lookImage: look.lookImage
    };

    const postData = {
      status: look.status,
      step: look.step,
      selectedModel: look.selectedModel,
      selectedScene: look.selectedScene,
      customModelPrompt: look.customModelPrompt,
      customScenePrompt: look.customScenePrompt,
      updatedAt: look.updatedAt
    };

    let promptText = '';
    if (look.selectedModel === CUSTOM_MODEL_ID && look.customModelPrompt) {
      promptText = look.customModelPrompt;
    } else {
      const model = MODELS.find(m => m.id === look.selectedModel);
      promptText = model?.promptFragment || '';
    }
    if (look.selectedScene === CUSTOM_SCENE_ID && look.customScenePrompt) {
      promptText += ' ' + look.customScenePrompt;
    } else {
      const scene = SCENES.find(s => s.id === look.selectedScene);
      promptText += ' ' + (scene?.promptFragment || '');
    }

    return {
      urls: JSON.stringify(imageUrls),
      post: JSON.stringify(postData),
      prompt: promptText.trim()
    };
  };

  // Helper: 将数据库格式转换为 Look
  const dbFormatToLook = (dbItem: any): Look => {
    let imageUrls: any = {};
    let postData: any = {};

    try {
      if (dbItem.urls && typeof dbItem.urls === 'string') {
          const trimmed = dbItem.urls.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
              imageUrls = JSON.parse(dbItem.urls);
          } else {
          imageUrls = { lookImage: dbItem.urls, collageImage: null, uploadedImages: [] };
        }
      }
    } catch { imageUrls = {}; }

    try {
      if (dbItem.post && typeof dbItem.post === 'string') {
          const trimmed = dbItem.post.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
              postData = JSON.parse(dbItem.post);
        }
            }
    } catch { postData = {}; }

    const uploadedImages: UploadedImage[] = (imageUrls.uploadedImages || []).map((img: any) => ({
      id: img.id,
      file: new File([], ''),
      previewUrl: img.previewUrl,
      base64: img.base64 || ''
    }));

    const finalLookImage = imageUrls.lookImage || (typeof dbItem.urls === 'string' && !dbItem.urls.startsWith('{') ? dbItem.urls : null);

    return {
      id: dbItem.id,
      name: dbItem.name,
      status: postData.status || 'draft',
      updatedAt: postData.updatedAt || new Date(dbItem.created_at).getTime(),
      step: postData.step || AppStep.UPLOAD,
      uploadedImages,
      collageImage: imageUrls.collageImage || null,
      lookImage: finalLookImage,
      selectedModel: postData.selectedModel || MODELS[0].id,
      customModelPrompt: postData.customModelPrompt,
      selectedScene: postData.selectedScene || SCENES[0].id,
      customScenePrompt: postData.customScenePrompt,
      urls: dbItem.urls,
      post: dbItem.post,
      prompt: dbItem.prompt,
      order: dbItem.order || 0
    };
  };

  // 通过 name 加载 Lookbook 和 Looks
  const loadLookbookByName = async () => {
    if (!activeLookbookName) {
      setCurrentLookbook(null);
      return;
    }

    setIsLoading(true);
    try {
      // 1. 通过 name 参数直接查询 Lookbook
      const decodedName = decodeURIComponent(activeLookbookName);
      const lookbooksResponse = await fetch(`/api/apple/web/for-you?name=${encodeURIComponent(decodedName)}`);
      const lookbooksResult = await lookbooksResponse.json();

      if (!lookbooksResult.success || !lookbooksResult.data || lookbooksResult.data.length === 0) {
        console.error('Lookbook not found:', decodedName);
        setCurrentLookbook(null);
        return;
      }

      const lookbookData = lookbooksResult.data[0];

      // 2. 加载 Looks，通过 name 参数直接查询
      const looksResponse = await fetch(`/api/apple/web/style-templates?name=${encodeURIComponent(decodedName)}`);
      const looksResult = await looksResponse.json();

          let looks: Look[] = [];
      if (looksResult.success && Array.isArray(looksResult.data)) {
        looks = looksResult.data.map((dbLook: any) => dbFormatToLook(dbLook));
      }

      setCurrentLookbook({
        id: lookbookData.id,
        name: lookbookData.name,
        url: lookbookData.url || '',
        createdAt: new Date(lookbookData.created_at).getTime(),
        updatedAt: new Date(lookbookData.updated_at).getTime(),
        looks,
        state: lookbookData.state !== undefined ? Number(lookbookData.state) : 0
      });
    } catch (error) {
      console.error('Error loading lookbook:', error);
      setCurrentLookbook(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Check API Key on mount and load lookbook
  useEffect(() => {
    async function checkApiKey() {
      if (window.aistudio) {
        const hasSelected = await window.aistudio.hasSelectedApiKey();
        setHasKey(hasSelected);
        if (hasSelected) loadLookbookByName();
      } else {
        setHasKey(true);
        loadLookbookByName();
      }
    }
    checkApiKey();
  }, [activeLookbookName]);

  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  // Look Actions
  const createLook = async () => {
    if (!currentLookbook) {
      alert('无法找到当前 Lookbook');
      return;
    }

    router.push(`/gemini/lookbook/create?name=${activeLookbookName}`);
  };

  const deleteLook = async (lookId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this look?')) return;

    try {
      const response = await fetch(`/api/apple/web/style-templates?id=${lookId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!result.success) {
        alert('删除失败，请稍后重试');
        return;
      }
    } catch (error) {
      console.error('Error deleting look:', error);
      alert('删除失败，请稍后重试');
      return;
    }

    setCurrentLookbook(prev => prev ? { ...prev, looks: prev.looks.filter(l => l.id !== lookId) } : null);
    setIsLookActionModalOpen(false);
    setSelectedLook(null);
  };

  const setLookAsPreview = async (look: Look) => {
    if (!currentLookbook) {
      alert('无法找到当前 Lookbook');
      return;
    }

    const previewUrl = look.post;
    if (!previewUrl) {
      alert('该 Look 没有可用的图片');
      return;
    }

    try {
      const response = await fetch('/api/apple/web/for-you', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentLookbook.id, url: previewUrl }),
      });

      const result = await response.json();
      if (!result.success) {
        alert(result.error || '设置预览图失败');
        return;
      }

      setCurrentLookbook(prev => prev ? { ...prev, url: previewUrl } : null);
      setIsLookActionModalOpen(false);
      setSelectedLook(null);
      alert('预览图设置成功');
    } catch (error) {
      console.error('Error setting preview image:', error);
      alert('设置预览图失败，请稍后重试');
    }
  };

  const handleLookClick = (look: Look, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLook(look);
    setIsLookActionModalOpen(true);
  };

  // 打开编辑 Prompt 对话框
  const handleEditPrompt = (look: Look) => {
    setSelectedLook(look);
    setEditingPrompt(look.prompt || '');
    setIsLookActionModalOpen(false);
    setIsEditPromptModalOpen(true);
  };

  // 保存 Prompt
  const handleSavePrompt = async () => {
    if (!selectedLook) return;

    setIsSavingPrompt(true);
    try {
      const response = await fetch('/api/apple/web/style-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedLook.id, prompt: editingPrompt.trim() }),
      });

      const result = await response.json();
      if (!result.success) {
        alert(result.error || '保存失败');
        return;
      }

      // 更新本地状态
      setCurrentLookbook(prev => {
        if (!prev) return null;
        return {
          ...prev,
          looks: prev.looks.map(l => 
            l.id === selectedLook.id 
              ? { ...l, prompt: editingPrompt.trim() }
              : l
          )
        };
      });

      setIsEditPromptModalOpen(false);
      setSelectedLook(null);
      setEditingPrompt('');
      alert('Prompt 保存成功');
    } catch (error) {
      console.error('Error saving prompt:', error);
      alert('保存失败，请稍后重试');
    } finally {
      setIsSavingPrompt(false);
    }
  };

  // 拖拽排序处理
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId || !currentLookbook) {
      setDraggedId(null);
      return;
    }

    const looks = currentLookbook.looks;
    const draggedIndex = looks.findIndex(l => l.id === draggedId);
    const targetIndex = looks.findIndex(l => l.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    const newLooks = [...looks];
    const [removed] = newLooks.splice(draggedIndex, 1);
    newLooks.splice(targetIndex, 0, removed);

    const updatedLooks = newLooks.map((l, index) => ({
      ...l,
      order: newLooks.length - index
    }));

    setCurrentLookbook(prev => prev ? { ...prev, looks: updatedLooks } : null);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // Render API Key Selection Screen
  if (!hasKey) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 text-center text-gray-900 font-sans">
        <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold mb-6 shadow-xl shadow-indigo-200">S</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">StyleForge AI</h1>
        <p className="text-gray-600 max-w-md mb-8 text-sm leading-relaxed">
          Please connect a Google Cloud Project with billing enabled to access professional features.
        </p>
        <button onClick={handleConnectKey} className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm">
          Connect API Key
        </button>
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="mt-6 text-xs text-gray-500 hover:text-gray-700 underline">
          Billing & Usage Info
        </a>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-indigo-600">Loading...</div>
      </div>
    );
  }

  // No lookbook found
  if (!currentLookbook) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 text-center">
        <p className="text-gray-600 mb-4">Lookbook not found</p>
        <button onClick={() => router.push('/gemini')} className="text-indigo-600 hover:text-indigo-700">
          返回首页
        </button>
      </div>
    );
  }

  // View: Lookbook Detail (List of Looks)
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <header className="border-b border-gray-200 sticky top-0 bg-white z-30">
          <div className="mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
            <button onClick={() => router.push('/gemini')} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
            <h1 className="text-lg font-bold text-gray-900">{currentLookbook.name}</h1>
            <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full">{currentLookbook.looks.length} Looks</span>
            </div>
            <button
              onClick={createLook}
              className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              + Create New Look
            </button>
          </div>
        </header>

      {/* 筛选和排序工具栏 */}
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          {/* 筛选按钮 */}
          {/* <div className="flex items-center bg-white rounded-lg p-0.5 border border-gray-200">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterStatus === 'all' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterStatus === 'completed' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              已完成
            </button>
            <button
              onClick={() => setFilterStatus('draft')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterStatus === 'draft' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              草稿
            </button>
          </div> */}
          {/* 排序按钮 */}
            <button
            disabled={isSavingOrder}
            onClick={async () => {
              if (isSortMode && currentLookbook) {
                setIsSavingOrder(true);
                try {
                  await Promise.all(
                    currentLookbook.looks.map((l, index) =>
                      fetch('/api/apple/web/style-templates', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: l.id, order: currentLookbook.looks.length - index })
                      })
                    )
                  );
                  // 重新加载数据
                  await loadLookbookByName();
                } catch (error) {
                  console.error('Error saving order:', error);
                } finally {
                  setIsSavingOrder(false);
                }
              }
              setIsSortMode(!isSortMode);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              isSortMode 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            } ${isSavingOrder ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSavingOrder ? (
              <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
              </svg>
            )}
            {isSavingOrder ? '保存中...' : (isSortMode ? '完成排序' : '排序')}
          </button>
        </div>
      </div>

      {/* 保存中遮罩 */}
      {isSavingOrder && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg px-6 py-4 flex items-center gap-3 shadow-lg">
            <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-700">正在保存排序...</span>
          </div>
        </div>
      )}

        <main className="w-full mx-auto px-4 py-6">
        {currentLookbook.looks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <p className="text-base font-medium mb-1.5">This Lookbook is empty</p>
              <p className="max-w-xs text-center mb-4 text-sm">Start by creating your first fashion look in this collection.</p>
              <button onClick={createLook} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">Create Look</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
            {currentLookbook.looks
              .filter(look => {
                if (filterStatus === 'all') return true;
                return look.status === filterStatus;
              })
              .map(look => (
                <div
                  key={look.id}
                draggable={isSortMode}
                onDragStart={(e) => handleDragStart(e, look.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, look.id)}
                onDragEnd={handleDragEnd}
                onClick={(e) => !isSortMode && handleLookClick(look, e)}
                className={`w-[400px] break-inside-avoid mb-4 group bg-white border rounded-lg overflow-hidden transition-all ${
                  isSortMode 
                    ? 'border-dashed border-indigo-300 cursor-grab active:cursor-grabbing' 
                    : 'border-gray-200 cursor-pointer hover:border-indigo-300 hover:shadow-xl hover:shadow-gray-200'
                } ${draggedId === look.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex flex-row justify-between">
                    <div className="bg-gray-50 relative">
                      {look.post ? (
                      <img src={look.post} className="max-w-[200px] w-auto h-auto object-cover aspect-[3/4]" alt="Final" loading="lazy" />
                      ) : (
                      <div className="w-[200px] h-[267px] flex items-center justify-center text-gray-400 text-sm">Empty</div>
                      )}
                    </div>
                    <div className="bg-gray-50 relative">
                      {look.urls ? (
                      <img src={look.urls} className="max-w-[200px] w-auto h-auto object-cover aspect-[3/4]" alt="Final" loading="lazy" />
                      ) : (
                      <div className="w-[200px] h-[267px] flex items-center justify-center text-gray-400 text-sm">Empty</div>
                      )}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-gray-900 text-sm font-medium truncate">{look.name}</h3>
                    <div className="flex justify-between items-center mt-1.5">
                    <span className="text-[10px] text-gray-500">{new Date(look.updatedAt).toLocaleDateString()}</span>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded`}>
                     Order : {look.order}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

      {/* Look Action Modal */}
      <Dialog open={isLookActionModalOpen} onOpenChange={setIsLookActionModalOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 [&>button]:text-gray-400 [&>button]:hover:text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">Look 操作</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedLook && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600 mb-4">选择要执行的操作：</div>
                <button
                  onClick={() => selectedLook && handleEditPrompt(selectedLook)}
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  编辑 Prompt
                </button>
                <button
                  onClick={() => selectedLook && setLookAsPreview(selectedLook)}
                  className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  设置为预览图
                </button>
                <button
                  onClick={() => selectedLook && deleteLook(selectedLook.id, undefined)}
                  className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  删除
                </button>
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => { setIsLookActionModalOpen(false); setSelectedLook(null); }}
              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              取消
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑 Prompt 对话框 */}
      <Dialog open={isEditPromptModalOpen} onOpenChange={setIsEditPromptModalOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 [&>button]:text-gray-400 [&>button]:hover:text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">编辑 Prompt</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedLook && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Look 名称: {selectedLook.name}
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prompt
                  </label>
                  <textarea
                    value={editingPrompt}
                    onChange={(e) => setEditingPrompt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    rows={8}
                    placeholder="输入 prompt 内容..."
                    disabled={isSavingPrompt}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => {
                setIsEditPromptModalOpen(false);
                setSelectedLook(null);
                setEditingPrompt('');
              }}
              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              disabled={isSavingPrompt}
            >
              取消
            </button>
            <button
              onClick={handleSavePrompt}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSavingPrompt}
            >
              {isSavingPrompt ? '保存中...' : '保存'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    );
};

export default App;
