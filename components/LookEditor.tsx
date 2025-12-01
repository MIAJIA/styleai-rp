import React, { useState, useEffect, useRef } from 'react';
import { UploadZone } from './UploadZone';
import { LoadingOverlay } from './LoadingOverlay';
import { MODELS, SCENES, CUSTOM_MODEL_ID, CUSTOM_SCENE_ID } from '@/app/gemini/type';
import { AppStep, Look, UploadedImage } from '@/app/gemini/type';

// 资源类型
const RESOURCE_TYPES = ['all', '上衣', '裤裙', '鞋', '包包'] as const;
type ResourceType = typeof RESOURCE_TYPES[number];

interface Resource {
  id: string;
  name: string;
  url: string;
  type: string;
}
import {
  generateCollage,
  generateVirtualTryOn
} from '@/lib/geminiService/geminiService';

interface LookEditorProps {
  look: Look;
  lookbookTitle: string;
  onUpdate: (updatedLook: Look) => void;
  onBack: () => void;
  onAddResource?: () => void;
}

export const LookEditor: React.FC<LookEditorProps> = ({ look, lookbookTitle, onUpdate, onBack, onAddResource }) => {
  console.log('look', look);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [editName, setEditName] = useState<string>(look.name);

  const collageIdRef = useRef<string>('');
  // 资产查询状态
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceType, setResourceType] = useState<ResourceType>('all');
  const [resourceSearch, setResourceSearch] = useState('');
  const [isLoadingResources, setIsLoadingResources] = useState(false);

  // 已选择的资源 ID 列表（用于保存到 shoplook 表）
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

  // 保存 Look 与 Resource 的关系到数据库
  const saveShoplookRelations = async (lookId: string, resourceIds: string[]) => {
    try {
      for (let i = 0; i < resourceIds.length; i++) {
        await fetch('/api/apple/web/shoplook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            look_id: lookId,
            resource_id: resourceIds[i],
            order: i
          })
        });
      }
      console.log('Shoplook relations saved successfully');
    } catch (error) {
      console.error('Error saving shoplook relations:', error);
    }
  };

  // 加载资源
  const loadResources = async () => {
    setIsLoadingResources(true);
    try {
      let url = '/api/apple/web/resources?';
      if (resourceType !== 'all') {
        url += `type=${resourceType}&`;
      }
      if (resourceSearch.trim()) {
        url += `name=${encodeURIComponent(resourceSearch.trim())}&`;
      }
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        setResources(result.data || []);
      }
    } catch (error) {
      console.error('Error loading resources:', error);
    } finally {
      setIsLoadingResources(false);
    }
  };

  // 初始加载和搜索条件变化时重新加载
  useEffect(() => {
    loadResources();
  }, [resourceType]);

  // 监听资源更新事件
  useEffect(() => {
    const handleResourceUpdated = () => {
      loadResources();
    };
    window.addEventListener('resourceUpdated', handleResourceUpdated);
    return () => {
      window.removeEventListener('resourceUpdated', handleResourceUpdated);
    };
  }, [resourceType, resourceSearch]);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      loadResources();
    }, 300);
    return () => clearTimeout(timer);
  }, [resourceSearch]);

  // 选择资源添加到上传图片
  const handleSelectResource = (resource: Resource) => {
    console.log('handleSelectResource called:', resource.id, resource.name);

    // 检查是否已添加（通过 uploadedImages 检查）
    if (look.uploadedImages.some(img => img.id === resource.id)) {
      console.log('Resource already added, skipping');
      return;
    }

    const newImage: UploadedImage = {
      id: resource.id,
      file: new File([], resource.name),
      previewUrl: resource.url,
      base64: resource.url // 使用资源 URL 作为 base64（后端会处理 URL）
    };

    const newUploadedImages = [...look.uploadedImages, newImage];
    console.log('Adding resource, new images count:', newUploadedImages.length);

    updateLook({ uploadedImages: newUploadedImages });
    // 记录选中的资源 ID
    setSelectedResourceIds(prev => [...prev, resource.id]);
  };

  const updateLook = (updates: Partial<Look>) => {
    onUpdate({ ...look, ...updates, updatedAt: Date.now() });
  };

  const handleAPIError = (e: any, action: string) => {
    console.error(`${action} failed`, e);
    const msg = e.message || JSON.stringify(e);
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('Requested entity was not found')) {
      alert(`Permission denied. Please check your API key settings.`);
    } else {
      alert(`${action} failed. Please try again.`);
    }
  };

  const handleImagesSelected = (images: UploadedImage[]) => {
    updateLook({ uploadedImages: [...look.uploadedImages, ...images] });
  };

  const handleDeleteImage = (imageId: string) => {
    const updatedImages = look.uploadedImages.filter(img => img.id !== imageId);
    updateLook({ uploadedImages: updatedImages });

    // 如果是资源，从 selectedResourceIds 中移除
    if (selectedResourceIds.includes(imageId)) {
      setSelectedResourceIds(prev => prev.filter(id => id !== imageId));
    }
  };

  const handleGenerateCollage = async () => {
    if (look.uploadedImages.length === 0) return;
    setLoading(true);
    setLoadingMessage('Composing your fashion flatlay...');
    try {
      const reqeustId = crypto.randomUUID();
      const b64s = look.uploadedImages.map(img => img.base64);
      for (let i = 0; i < 3; i++) {
        const result = await fetch('/api/apple/web/collage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: lookbookTitle, urls: b64s, requestId: reqeustId }),
        });
        if (!result.ok) {
          if (i === 2) {
            throw new Error('Failed to generate collage');
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * 5));
          continue;
        }
        const data = await result.json();
        updateLook({ collageImage: data.url, id: data?.id || '', step: AppStep.COLLAGE });
        collageIdRef.current = data?.id || '';

        // 生成成功后，保存 Look 与 Resource 的关系到数据库
        if (selectedResourceIds.length > 0 && data?.id) {
          await saveShoplookRelations(data?.id, selectedResourceIds);
        }
        break;
      }
    } catch (e: any) {
      handleAPIError(e, 'Collage generation');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLook = async () => {
    if (!look.collageImage) return;
    setLoading(true);
    setLoadingMessage('Drafting the virtual photoshoot...');

    // Determine Model Prompt
    let modelPrompt = '';
    if (look.selectedModel === CUSTOM_MODEL_ID) {
      if (!look.customModelPrompt?.trim()) {
        alert("Please enter a description for your custom model.");
        setLoading(false);
        return;
      }
      modelPrompt = look.customModelPrompt;
    } else {
      const model = MODELS.find(m => m.id === look.selectedModel);
      modelPrompt = model?.promptFragment || '';
    }

    // Determine Scene Prompt
    let scenePrompt = '';
    if (look.selectedScene === CUSTOM_SCENE_ID) {
      if (!look.customScenePrompt?.trim()) {
        alert("Please enter a description for your custom scene.");
        setLoading(false);
        return;
      }
      scenePrompt = look.customScenePrompt;
    } else {
      const scene = SCENES.find(s => s.id === look.selectedScene);
      scenePrompt = scene?.promptFragment || '';
    }

    try {
      for (let i = 0; i < 3; i++) {
        const result = await fetch('/api/apple/web/tryon', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: collageIdRef.current,
            name: look.name,
            collage: look.collageImage,
            modelPrompt: modelPrompt,
            scenePrompt: scenePrompt,
            resourceIds: selectedResourceIds // 传递选中的资源 ID
          }),
        });

        if (!result.ok) {
          if (i === 2) {
            throw new Error('Failed to generate virtual try-on');
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * 5));
          continue;
        }
        const data = await result.json();
        updateLook({ lookImage: data.url, step: AppStep.TRY_ON });
        break;
      }
      collageIdRef.current = '';
    } catch (e: any) {
      handleAPIError(e, 'Virtual Try-On');
    } finally {
      setLoading(false);
    }
  };

  const handleNameBlur = () => {
    if (editName !== look.name) {
      updateLook({ name: editName });
    }
  };

  // Helper to render label for final view
  const getSelectedLabel = (id: string, isModel: boolean) => {
    if (id === CUSTOM_MODEL_ID || id === CUSTOM_SCENE_ID) return 'Custom';
    if (isModel) return MODELS.find(m => m.id === id)?.label;
    return SCENES.find(s => s.id === id)?.label;
  };

  return (
    <div className="animate-fade-in pb-20 bg-gradient-to-br  via-indigo-50 to-purple-50">
      {loading && <LoadingOverlay message={loadingMessage} />}

      {/* Editor Header */}
      <div className="border-b border-blue-200 bg-white/90 sticky top-0 z-40 py-4 mb-8 shadow-sm">
        <div className="mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              {lookbookTitle}
            </button>
            <div className="h-6 w-px bg-blue-200"></div>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameBlur}
              className="bg-transparent text-xl font-bold text-blue-900 focus:outline-none focus:border-b border-indigo-500 w-64"
            />
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className={`flex items-center gap-2 ${look.step === AppStep.UPLOAD ? 'text-indigo-600 font-semibold' : 'text-blue-400'}`}>
              <span className="font-mono">01</span> Upload
            </div>
            <div className={`w-8 h-px bg-blue-200`}></div>
            <div className={`flex items-center gap-2 ${look.step === AppStep.COLLAGE ? 'text-indigo-600 font-semibold' : 'text-blue-400'}`}>
              <span className="font-mono">02</span> Collage
            </div>
            <div className={`w-8 h-px bg-blue-200`}></div>
            <div className={`flex items-center gap-2 ${look.step === AppStep.TRY_ON ? 'text-indigo-600 font-semibold' : 'text-blue-400'}`}>
              <span className="font-mono">03</span> Visualize
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6">

        {/* Step 1: Upload */}
        {look.step === AppStep.UPLOAD && (
          <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row gap-12">
              <div className="w-full md:w-1/2">
                <h1 className="text-4xl font-bold text-blue-900 mb-4">Add Items</h1>
                <p className="text-blue-700 text-lg mb-8">Upload clothing items to curate this look.</p>
                <UploadZone onImagesSelected={handleImagesSelected} />
              </div>

              <div className="w-full md:w-1/2 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 min-h-[400px] shadow-lg">
                <h3 className="text-sm font-medium text-blue-600 uppercase tracking-wider mb-4">Selected Items ({look.uploadedImages.length})</h3>
                {look.uploadedImages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-blue-400 italic">
                    No items selected yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {look.uploadedImages.map(img => (
                      <div key={img.id} className="relative aspect-square bg-white rounded-lg overflow-hidden group border border-blue-200 hover:border-blue-400 transition-all shadow-sm hover:shadow-md">
                        <img src={img.previewUrl} alt="Item" className="w-full h-full object-contain p-2" />
                        <button
                          onClick={() => handleDeleteImage(img.id)}
                          className="absolute top-2 right-2 p-1.5 bg-white/95 text-blue-700 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all backdrop-blur-sm shadow-md"
                          title="Remove item"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {look.uploadedImages.length > 0 && (
                  <button
                    onClick={handleGenerateCollage}
                    className="w-full mt-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all transform active:scale-95 shadow-lg shadow-indigo-200"
                  >
                    Generate Collage
                  </button>
                )}
              </div>
            </div>
            <div className='flex-1 bg-gray-50 rounded-xl p-4 my-4 border border-gray-200'>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">资源库</h3>
                {onAddResource && (
                  <button
                    onClick={onAddResource}
                    className="px-2 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    + 新增
                  </button>
                )}
              </div>

              {/* 搜索和筛选 */}
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  placeholder="搜索资源..."
                  value={resourceSearch}
                  onChange={(e) => setResourceSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
                />
                <div className="flex flex-wrap gap-1">
                  {RESOURCE_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setResourceType(type)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${resourceType === type
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                    >
                      {type === 'all' ? '全部' : type}
                    </button>
                  ))}
                </div>
              </div>

              {/* 资源列表 */}
              <div className="h-[300px] overflow-y-auto">
                {isLoadingResources ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    加载中...
                  </div>
                ) : resources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2">
                    <span>暂无资源</span>
                    {onAddResource && (
                      <button
                        onClick={onAddResource}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        + 添加资源
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {resources.map(resource => (
                      <div
                        key={resource.id}
                        onClick={() => handleSelectResource(resource)}
                        className="w-[160px] cursor-pointer group relative rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-400 transition-colors"
                      >
                        <img
                          src={resource.url}
                          alt={resource.name}
                          className="w-full aspect-[3/4] object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium">
                            + 添加
                          </span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-white/90 px-1 py-0.5">
                          <p className="text-[10px] text-gray-600 truncate">{resource.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Collage */}
        {look.step === AppStep.COLLAGE && look.collageImage && (
          <div className="animate-fade-in flex flex-col lg:flex-row gap-12">
            <div className="lg:w-1/2">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-2 border border-blue-200 shadow-lg">
                <div className="bg-white rounded-lg overflow-hidden shadow-inner">
                  <img src={look.collageImage} alt="Collage" className="w-full h-auto" />
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <button onClick={() => updateLook({ step: AppStep.UPLOAD })} className="text-sm text-blue-600 hover:text-blue-700 font-medium">← Add more items</button>
              </div>
            </div>

            <div className="lg:w-1/2 space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-blue-900 mb-2">Configure Shoot</h2>
                <p className="text-blue-700">Select parameters for the virtual try-on.</p>
              </div>

              {/* Model Selection */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-blue-700">Model</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => updateLook({ selectedModel: model.id })}
                      className={`p-4 rounded-xl border text-left transition-all text-sm shadow-sm ${look.selectedModel === model.id
                        ? 'bg-gradient-to-br from-indigo-100 to-blue-100 border-indigo-500 text-indigo-700 shadow-md'
                        : 'bg-white border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                    >
                      {model.label}
                    </button>
                  ))}
                  {/* Custom Model Button */}
                  <button
                    onClick={() => updateLook({ selectedModel: CUSTOM_MODEL_ID })}
                    className={`p-4 rounded-xl border text-left transition-all text-sm flex items-center gap-2 shadow-sm ${look.selectedModel === CUSTOM_MODEL_ID
                      ? 'bg-gradient-to-br from-indigo-100 to-blue-100 border-indigo-500 text-indigo-700 shadow-md'
                      : 'bg-white border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    Custom Model
                  </button>
                </div>

                {/* Custom Model Input */}
                {look.selectedModel === CUSTOM_MODEL_ID && (
                  <div className="animate-fade-in">
                    <textarea
                      placeholder="Describe the model (e.g., 'A futuristic cyborg with silver hair' or 'A redhead model with freckles')"
                      value={look.customModelPrompt || ''}
                      onChange={(e) => updateLook({ customModelPrompt: e.target.value })}
                      className="w-full bg-white border border-blue-300 rounded-lg p-3 text-sm text-blue-900 placeholder-blue-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 h-24 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Scene Selection */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-blue-700">Scene</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SCENES.map(scene => (
                    <button
                      key={scene.id}
                      onClick={() => updateLook({ selectedScene: scene.id })}
                      className={`p-4 rounded-xl border text-left transition-all text-sm shadow-sm ${look.selectedScene === scene.id
                        ? 'bg-gradient-to-br from-cyan-100 to-blue-100 border-cyan-500 text-cyan-700 shadow-md'
                        : 'bg-white border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                    >
                      {scene.label}
                    </button>
                  ))}
                  {/* Custom Scene Button */}
                  <button
                    onClick={() => updateLook({ selectedScene: CUSTOM_SCENE_ID })}
                    className={`p-4 rounded-xl border text-left transition-all text-sm flex items-center gap-2 shadow-sm ${look.selectedScene === CUSTOM_SCENE_ID
                      ? 'bg-gradient-to-br from-cyan-100 to-blue-100 border-cyan-500 text-cyan-700 shadow-md'
                      : 'bg-white border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    Custom Scene
                  </button>
                </div>

                {/* Custom Scene Input */}
                {look.selectedScene === CUSTOM_SCENE_ID && (
                  <div className="animate-fade-in">
                    <textarea
                      placeholder="Describe the environment (e.g., 'A vintage 50s diner' or 'A mossy forest with fairy lights')"
                      value={look.customScenePrompt || ''}
                      onChange={(e) => updateLook({ customScenePrompt: e.target.value })}
                      className="w-full bg-white border border-blue-300 rounded-lg p-3 text-sm text-blue-900 placeholder-blue-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 h-24 resize-none"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleGenerateLook}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-700 hover:via-blue-700 hover:to-cyan-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all transform active:scale-95"
              >
                Visualize Look
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Try On Result */}
        {look.step === AppStep.TRY_ON && look.lookImage && (
          <div className="animate-fade-in max-w-5xl mx-auto">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-3xl font-bold text-blue-900">Final Look</h2>
              </div>
              <div className="space-x-4">
                {/* <button onClick={() => updateLook({ step: AppStep.COLLAGE })} className="px-4 py-2 rounded-lg border border-blue-300 hover:bg-blue-50 text-blue-700 font-medium transition-colors">Back</button> */}
                <button
                  onClick={() => {
                    updateLook({ status: 'completed' });
                    onBack();
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-blue-200 transition-all"
                >
                  Save & Finish
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden border border-blue-200 shadow-xl">
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-1/3 p-6 border-r border-blue-200 flex flex-col gap-4 bg-gradient-to-br from-blue-50 to-indigo-50">
                  <h4 className="font-medium text-blue-600 uppercase text-xs tracking-wider">References</h4>
                  <div className="rounded-lg overflow-hidden bg-white shadow-sm">
                    <img src={look.collageImage || ''} alt="Ref" className="w-full opacity-90" />
                  </div>
                  <div className="mt-auto">
                    <p className="text-xs text-blue-700">
                      <span className="text-blue-600 font-medium">Model:</span> <br />
                      {getSelectedLabel(look.selectedModel, true)}
                      {look.selectedModel === CUSTOM_MODEL_ID && look.customModelPrompt && (
                        <span className="block mt-1 italic text-blue-500 truncate">"{look.customModelPrompt}"</span>
                      )}
                      <br /><br />
                      <span className="text-blue-600 font-medium">Scene:</span> <br />
                      {getSelectedLabel(look.selectedScene, false)}
                      {look.selectedScene === CUSTOM_SCENE_ID && look.customScenePrompt && (
                        <span className="block mt-1 italic text-blue-500 truncate">"{look.customScenePrompt}"</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="w-full md:w-2/3 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                  <img src={look.lookImage} alt="Final Look" className="max-h-[70vh] w-auto object-contain shadow-lg" />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};