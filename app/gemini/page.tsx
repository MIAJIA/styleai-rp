"use client";

import React, { useState, useEffect } from 'react';
import { LookEditor } from '@/components/LookEditor';
import { MODELS, SCENES, AppStep, Look, Lookbook, CUSTOM_MODEL_ID, CUSTOM_SCENE_ID, UploadedImage } from './type';
import { useRouter } from 'next/navigation';
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
  // Global State
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [isLoadingLookbooks, setIsLoadingLookbooks] = useState(false);
  
  // Navigation State
  const [activeLookbookId, setActiveLookbookId] = useState<string | null>(null);
  // UI State for Lookbook creation
  const [isCreatingLB, setIsCreatingLB] = useState(false);
  const [newLBTitle, setNewLBTitle] = useState('');

  // UI State for Look action modal
  const [isLookActionModalOpen, setIsLookActionModalOpen] = useState(false);
  const [selectedLook, setSelectedLook] = useState<Look | null>(null);

  // 排序模式状态
  const [isSortMode, setIsSortMode] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // 筛选状态：'all' | 'online' | 'offline' | 'deleted'
  const [filterState, setFilterState] = useState<'all' | 'online' | 'offline' | 'deleted'>('all');

  // Load Lookbooks from database
  const loadLookbooks = async (includeDeleted = false) => {
    console.log('=== Starting loadLookbooks ===');
    setIsLoadingLookbooks(true);
    try {
      const url = includeDeleted ? '/api/apple/web/for-you?include_deleted=true' : '/api/apple/web/for-you';
      console.log('Fetching', url);
      const response = await fetch(url);
      console.log('Response status:', response.status, response.statusText);

      const result = await response.json();
      console.log('=== Lookbooks API Response ===');
      console.log('Success:', result.success);
      console.log('Data:', result.data);
      console.log('Data length:', result.data?.length || 0);
      if (result.error) {
        console.error('Error:', result.error);
      }

      if (result.success && result.data) {
        // 将数据库数据转换为 Lookbook 格式（Dashboard 页面不需要加载 Looks 数据）
        const loadedLookbooks: Lookbook[] = result.data.map((item: any) => {
          return {
            id: item.id,
            name: item.name,
            url: item.url || '',
            createdAt: new Date(item.created_at).getTime(),
            updatedAt: new Date(item.updated_at).getTime(),
            looks: [], // Dashboard 页面不需要加载 Looks，留空数组
            state: item.state !== undefined ? Number(item.state) : 0,
            order: item.order !== undefined ? Number(item.order) : 0
          };
        });

        setLookbooks(loadedLookbooks);
      } else {
        console.error('Failed to load lookbooks - result.success is false or no data');
        console.error('Result:', result);
        setLookbooks([]);
      }
    } catch (error) {
      console.error('=== Error loading lookbooks ===');
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Full error:', error);
      setLookbooks([]);
    } finally {
      setIsLoadingLookbooks(false);
      console.log('=== loadLookbooks completed ===\n');
    }
  };

  // Check API Key on mount and load lookbooks
  useEffect(() => {
    async function checkApiKey() {
      if (window.aistudio) {
        const hasSelected = await window.aistudio.hasSelectedApiKey();
        setHasKey(hasSelected);
        if (hasSelected) {
          loadLookbooks(filterState === 'deleted');
        }
      } else {
        setHasKey(true);
        loadLookbooks(filterState === 'deleted');
      }
    }
    checkApiKey();
  }, [filterState]);

  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  // Helpers

  // Lookbook Actions
  const createLookbook = async () => {
    if (!newLBTitle.trim()) {
      return;
    }
    try {
      // 保存到数据库
      const response = await fetch('/api/apple/web/for-you', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newLBTitle.trim(),
        }),
      });

      // 检查响应状态
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        // 根据不同的错误类型显示不同的提示
        let errorMessage = '创建失败';
        if (result.error) {
          if (result.error.includes('already exists') || result.error.includes('Name already exists')) {
            errorMessage = '该名称已存在，请使用其他名称';
          } else if (result.error.includes('required')) {
            errorMessage = '请输入集合名称';
          } else {
            errorMessage = result.error;
          }
        }
        return;
      }

      // 创建本地 Lookbook 对象
    const newLB: Lookbook = {
        id: result.data.id,
        name: result.data.name, // 使用数据库返回的 name
        url: result.data.url || '', // 使用数据库返回的 url
        createdAt: new Date(result.data.created_at).getTime(),
        updatedAt: new Date(result.data.updated_at).getTime(),
        looks: [],
        state: result.data.state !== undefined ? Number(result.data.state) : 0
    };

    setLookbooks([newLB, ...lookbooks]);
    setNewLBTitle('');
      setIsCreatingLB(false);

      // 重新加载以确保数据同步
      await loadLookbooks();
      router.push(`/gemini/lookbook?name=${newLB.name}`);
    } catch (error: any) {
      console.error('Error creating lookbook:', error);
      let errorMessage = '创建失败，请稍后重试';

      if (error.message) {
        if (error.message.includes('Network') || error.message.includes('fetch')) {
          errorMessage = '网络连接失败，请检查网络后重试';
        } else if (error.message.includes('already exists')) {
          errorMessage = '该名称已存在，请使用其他名称';
        } else {
          errorMessage = error.message;
        }
      }

    } finally {
    }
  };

  const handleCancelCreateLB = () => {
    setIsCreatingLB(false);
    setNewLBTitle('');
  };

  const updateLookbookStatus = async (id: string, newState: number, e: React.MouseEvent) => {
    e.stopPropagation();

    // 检查当前 Lookbook 的 url 是否为空
    const currentLookbook = lookbooks.find(lb => lb.id === id);
    if (currentLookbook && (!currentLookbook.url || currentLookbook.url.trim() === '')) {
      // 如果要上线（state = 1），提醒用户设置预览图
      if (newState === 1) {
        window.confirm('预览图为空，上线后可能无法正常显示。是否继续上线？')
        return;
      }
    }

    try {
      const response = await fetch('/api/apple/web/for-you', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id,
          state: newState
        }),
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.error || '更新状态失败');
        return;
      }

      // 更新本地状态
      setLookbooks(prev => prev.map(lb =>
        lb.id === id ? { ...lb, state: newState } : lb
      ));
    } catch (error) {
      console.error('Error updating lookbook state:', error);
      alert('更新状态失败');
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

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const draggedIndex = lookbooks.findIndex(lb => lb.id === draggedId);
    const targetIndex = lookbooks.findIndex(lb => lb.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    // 重新排序
    const newLookbooks = [...lookbooks];
    const [removed] = newLookbooks.splice(draggedIndex, 1);
    newLookbooks.splice(targetIndex, 0, removed);

    // 更新 order（order 大的在前）
    const updatedLookbooks = newLookbooks.map((lb, index) => ({
      ...lb,
      order: newLookbooks.length - index // order 大的在前
    }));

    setLookbooks(updatedLookbooks);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const deleteLookbook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this lookbook and all its looks?')) {
      return;
    }

    try {
      const response = await fetch(`/api/apple/web/for-you?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.error || 'Failed to delete lookbook');
        return;
      }

      // 更新本地状态
      setLookbooks(prev => prev.filter(lb => lb.id !== id));
      if (activeLookbookId === id) setActiveLookbookId(null);

      // 重新加载以确保数据同步
      await loadLookbooks(filterState === 'deleted');
    } catch (error) {
      console.error('Error deleting lookbook:', error);
      alert('Failed to delete lookbook');
    }
  };

  const restoreLookbook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch('/api/apple/web/for-you', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, state: 0 }),
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.error || 'Failed to restore lookbook');
        return;
      }

      // 更新本地状态
      setLookbooks(prev => prev.map(lb => lb.id === id ? { ...lb, state: 0 } : lb));
      
      // 重新加载
      await loadLookbooks(filterState === 'deleted');
    } catch (error) {
      console.error('Error restoring lookbook:', error);
      alert('Failed to restore lookbook');
    }
  };


  const deleteLook = async (lookId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!window.confirm('Delete this look?')) return;
    
    // 从数据库删除
    try {
      const response = await fetch(`/api/apple/web/style-templates?id=${lookId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (!result.success) {
        console.error('Failed to delete look from database:', result.error);
        alert('删除失败，请稍后重试');
        return;
      }
    } catch (error) {
      console.error('Error deleting look:', error);
      alert('删除失败，请稍后重试');
      return;
    }

    // 更新本地状态
    setLookbooks(prev => prev.map(lb => {
      // Robustly find the lookbook containing this look and remove it
      if (lb.looks.some(l => l.id === lookId)) {
         return { ...lb, looks: lb.looks.filter(l => l.id !== lookId) };
      }
      return lb;
    }));

    // 关闭 modal
    setIsLookActionModalOpen(false);
    setSelectedLook(null);
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
  // View: Dashboard (Lookbooks)
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-30">
        <div className="mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">S</div>
            <span className="font-semibold text-lg tracking-tight text-gray-900">StyleForge AI</span>
          </div>
          <div className="flex items-center gap-2">

            <button
              onClick={() => router.push('/gemini/resource')}
              className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors flex items-center gap-1.5"
            >Your Resources
            </button>
          <button 
            onClick={() => setIsCreatingLB(true)}
              className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
          >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            New Lookbook
          </button>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 pt-6">
        <div className="flex items-end justify-between mb-6">
           <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">My Lookbooks</h1>
            <p className="text-gray-600 text-sm">Manage your fashion collections and storyboards.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* 筛选按钮 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setFilterState('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterState === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setFilterState('online')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterState === 'online' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                上线
              </button>
              <button
                onClick={() => setFilterState('offline')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterState === 'offline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                下架
              </button>
              <button
                onClick={() => setFilterState('deleted')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterState === 'deleted' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                已删除
              </button>
            </div>
            {/* 排序按钮 */}
            <button
              disabled={isSavingOrder}
              onClick={async () => {
                if (isSortMode) {
                  // 完成排序时，同步顺序到数据库
                  setIsSavingOrder(true);
                  try {
                    await Promise.all(
                      lookbooks.map((lb, index) =>
                        fetch('/api/apple/web/for-you', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: lb.id, order: lookbooks.length - index })
                        })
                      )
                    );
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
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

        {isLoadingLookbooks ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-2 text-gray-500">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">Loading collections...</span>
            </div>
          </div>
        ) : lookbooks.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-xl">
            <p className="text-gray-500 mb-3 text-sm">No lookbooks yet.</p>
            <button onClick={() => setIsCreatingLB(true)} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">Create your first collection</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {lookbooks
              .filter(lb => {
                if (filterState === 'all') return (lb.state ?? 0) < 2; // 默认不显示已删除
                if (filterState === 'online') return (lb.state ?? 0) === 1;
                if (filterState === 'offline') return (lb.state ?? 0) === 0;
                if (filterState === 'deleted') return (lb.state ?? 0) === 2;
                return true;
              })
              .map(lb => (
              <div 
                key={lb.id} 
                draggable={isSortMode}
                onDragStart={(e) => isSortMode && handleDragStart(e, lb.id)}
                onDragOver={isSortMode ? handleDragOver : undefined}
                onDrop={(e) => isSortMode && handleDrop(e, lb.id)}
                onDragEnd={handleDragEnd}
                className={`w-[200px] bg-white border rounded-lg p-4 transition-all ${
                  isSortMode 
                    ? 'cursor-grab active:cursor-grabbing border-dashed border-indigo-300 hover:border-indigo-500' 
                    : 'cursor-pointer border-gray-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-gray-200'
                } ${draggedId === lb.id ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                      </svg>
                   </div>
                  {/* Status Toggle Switch - 仅在非删除状态显示 */}
                  {(lb.state ?? 0) < 2 && (
                    <button
                      onClick={(e) => updateLookbookStatus(lb.id, ((lb.state ?? 0) === 1 ? 0 : 1), e)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${(lb.state ?? 0) === 1 ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                      title={(lb.state ?? 0) === 1 ? '上线中，点击下架' : '已下架，点击上线'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(lb.state ?? 0) === 1 ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                      />
                    </button>
                  )}
                  {/* 恢复按钮 - 仅在删除状态显示 */}
                  {(lb.state ?? 0) === 2 && (
                    <button
                      onClick={(e) => restoreLookbook(lb.id, e)}
                      className="text-gray-400 hover:text-green-600 p-1.5"
                      title="恢复"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                      </svg>
                    </button>
                  )}
                  {/* 删除按钮 - 仅在非删除状态显示 */}
                  {(lb.state ?? 0) < 2 && (
                   <button 
                     onClick={(e) => deleteLookbook(lb.id, e)}
                      className="text-gray-400 hover:text-red-600 p-1.5"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                  )}
                </div>
                <div onClick={() => {
                  router.push(`/gemini/lookbook?name=${encodeURIComponent(lb.name)}`);
                }}>
                  <div className="mb-3 rounded-lg overflow-hidden bg-gray-50 aspect-[3/4] flex items-center justify-center relative"

                  >
                    {lb.url ? (
                      <img
                        src={lb.url}
                        alt={lb.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-6.364-6.364l2.909-2.909m-6.364 6.364l-2.909 2.909m0 0l-1.409 1.409m1.409-1.409l-1.409-1.409M2.25 15.75V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-2.25m-16.5 0V9m16.5 6.75V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-2.25m16.5 0V9M3 6.75h16.5" />
                        </svg>
                        <p className="text-xs text-center">需要上传图片</p>
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">{lb.name}</h3>
                  <div className="flex items-center justify-between gap-3 text-[10px] font-medium text-gray-500">
                   <span>Created {new Date(lb.createdAt).toLocaleDateString()}</span>
                    <span>Order : {lb.order}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Lookbook Modal */}
      <Dialog open={isCreatingLB} onOpenChange={setIsCreatingLB}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 [&>button]:text-gray-400 [&>button]:hover:text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Create New Collection
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <input
              autoFocus
              type="text"
              placeholder="Collection Name"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500"
              value={newLBTitle}
              onChange={(e) => setNewLBTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createLookbook()}
            />
          </div>
          <DialogFooter>
            <button
              onClick={handleCancelCreateLB}
              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createLookbook}
              disabled={!newLBTitle.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default App;