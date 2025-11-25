import React, { useState } from 'react';
import { UploadZone } from './UploadZone';
import { LoadingOverlay } from './LoadingOverlay';
import { MODELS, SCENES, CUSTOM_MODEL_ID, CUSTOM_SCENE_ID } from '@/app/gemini/type';
import { AppStep, Look, UploadedImage } from '@/app/gemini/type';
import { 
  generateCollage, 
  generateVirtualTryOn 
} from '@/lib/geminiService/geminiService';

interface LookEditorProps {
  look: Look;
  lookbookTitle: string;
  onUpdate: (updatedLook: Look) => void;
  onBack: () => void;
}

export const LookEditor: React.FC<LookEditorProps> = ({ look, lookbookTitle, onUpdate, onBack }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [editName, setEditName] = useState<string>(look.name);

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
  };

  const handleGenerateCollage = async () => {
    if (look.uploadedImages.length === 0) return;
    setLoading(true);
    setLoadingMessage('Composing your fashion flatlay...');
    try {
      const b64s = look.uploadedImages.map(img => img.base64);
      const result = await generateCollage(b64s);
      updateLook({ collageImage: result, step: AppStep.COLLAGE });
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
      const result = await generateVirtualTryOn(
        look.collageImage, 
        modelPrompt, 
        scenePrompt
      );
      updateLook({ lookImage: result, step: AppStep.TRY_ON });
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
    <div className="animate-fade-in pb-20">
      {loading && <LoadingOverlay message={loadingMessage} />}

      {/* Editor Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 py-4 mb-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-zinc-500 hover:text-white flex items-center gap-1 transition-colors text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              {lookbookTitle}
            </button>
            <div className="h-6 w-px bg-zinc-800"></div>
            <input 
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameBlur}
              className="bg-transparent text-xl font-bold text-white focus:outline-none focus:border-b border-indigo-500 w-64"
            />
          </div>
          <div className="flex items-center gap-6 text-sm">
             <div className={`flex items-center gap-2 ${look.step === AppStep.UPLOAD ? 'text-indigo-400' : 'text-zinc-600'}`}>
                <span className="font-mono">01</span> Upload
             </div>
             <div className={`w-8 h-px bg-zinc-800`}></div>
             <div className={`flex items-center gap-2 ${look.step === AppStep.COLLAGE ? 'text-indigo-400' : 'text-zinc-600'}`}>
                <span className="font-mono">02</span> Collage
             </div>
             <div className={`w-8 h-px bg-zinc-800`}></div>
             <div className={`flex items-center gap-2 ${look.step === AppStep.TRY_ON ? 'text-indigo-400' : 'text-zinc-600'}`}>
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
                 <h1 className="text-4xl font-bold text-white mb-4">Add Items</h1>
                 <p className="text-zinc-400 text-lg mb-8">Upload clothing items to curate this look.</p>
                 <UploadZone onImagesSelected={handleImagesSelected} />
              </div>
              
              <div className="w-full md:w-1/2 bg-zinc-900 rounded-2xl p-6 min-h-[400px]">
                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Selected Items ({look.uploadedImages.length})</h3>
                {look.uploadedImages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-600 italic">
                    No items selected yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {look.uploadedImages.map(img => (
                      <div key={img.id} className="relative aspect-square bg-white rounded-lg overflow-hidden group border border-transparent hover:border-zinc-500 transition-colors">
                         <img src={img.previewUrl} alt="Item" className="w-full h-full object-contain p-2" />
                         <button 
                           onClick={() => handleDeleteImage(img.id)}
                           className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all backdrop-blur-sm"
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
                    className="w-full mt-8 py-4 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl transition-all transform active:scale-95"
                  >
                    Generate Collage
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Collage */}
        {look.step === AppStep.COLLAGE && look.collageImage && (
          <div className="animate-fade-in flex flex-col lg:flex-row gap-12">
            <div className="lg:w-1/2">
              <div className="bg-zinc-900 rounded-xl p-2 border border-zinc-800">
                <div className="bg-white rounded-lg overflow-hidden">
                   <img src={look.collageImage} alt="Collage" className="w-full h-auto" />
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <button onClick={() => updateLook({ step: AppStep.UPLOAD })} className="text-sm text-zinc-500 hover:text-white">← Add more items</button>
              </div>
            </div>

            <div className="lg:w-1/2 space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Configure Shoot</h2>
                <p className="text-zinc-400">Select parameters for the virtual try-on.</p>
              </div>

              {/* Model Selection */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-zinc-300">Model</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => updateLook({ selectedModel: model.id })}
                      className={`p-4 rounded-xl border text-left transition-all text-sm ${
                        look.selectedModel === model.id 
                          ? 'bg-indigo-900/20 border-indigo-500 text-indigo-200' 
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {model.label}
                    </button>
                  ))}
                  {/* Custom Model Button */}
                  <button
                    onClick={() => updateLook({ selectedModel: CUSTOM_MODEL_ID })}
                    className={`p-4 rounded-xl border text-left transition-all text-sm flex items-center gap-2 ${
                      look.selectedModel === CUSTOM_MODEL_ID
                        ? 'bg-indigo-900/20 border-indigo-500 text-indigo-200' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
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
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 h-24 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Scene Selection */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-zinc-300">Scene</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SCENES.map(scene => (
                    <button
                      key={scene.id}
                      onClick={() => updateLook({ selectedScene: scene.id })}
                      className={`p-4 rounded-xl border text-left transition-all text-sm ${
                        look.selectedScene === scene.id 
                          ? 'bg-emerald-900/20 border-emerald-500 text-emerald-200' 
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {scene.label}
                    </button>
                  ))}
                  {/* Custom Scene Button */}
                  <button
                    onClick={() => updateLook({ selectedScene: CUSTOM_SCENE_ID })}
                    className={`p-4 rounded-xl border text-left transition-all text-sm flex items-center gap-2 ${
                      look.selectedScene === CUSTOM_SCENE_ID
                        ? 'bg-emerald-900/20 border-emerald-500 text-emerald-200' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
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
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 h-24 resize-none"
                    />
                  </div>
                )}
              </div>

              <button 
                onClick={handleGenerateLook}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-900/20 transition-all transform active:scale-95"
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
                 <h2 className="text-3xl font-bold text-white">Final Look</h2>
               </div>
               <div className="space-x-4">
                  <button onClick={() => updateLook({ step: AppStep.COLLAGE })} className="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300">Back</button>
                  <button 
                    onClick={() => {
                        updateLook({ status: 'completed' });
                        onBack();
                    }}
                    className="px-6 py-2 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 shadow-lg shadow-white/10"
                  >
                    Save & Finish
                  </button>
               </div>
            </div>

            <div className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
              <div className="flex flex-col md:flex-row">
                 <div className="w-full md:w-1/3 p-6 border-r border-zinc-800 flex flex-col gap-4">
                    <h4 className="font-medium text-zinc-500 uppercase text-xs tracking-wider">References</h4>
                    <div className="rounded-lg overflow-hidden bg-white">
                       <img src={look.collageImage || ''} alt="Ref" className="w-full opacity-90" />
                    </div>
                    <div className="mt-auto">
                       <p className="text-xs text-zinc-600">
                         <span className="text-zinc-400">Model:</span> <br/>
                         {getSelectedLabel(look.selectedModel, true)}
                         {look.selectedModel === CUSTOM_MODEL_ID && look.customModelPrompt && (
                           <span className="block mt-1 italic text-zinc-500 truncate">"{look.customModelPrompt}"</span>
                         )}
                         <br/><br/>
                         <span className="text-zinc-400">Scene:</span> <br/>
                         {getSelectedLabel(look.selectedScene, false)}
                         {look.selectedScene === CUSTOM_SCENE_ID && look.customScenePrompt && (
                           <span className="block mt-1 italic text-zinc-500 truncate">"{look.customScenePrompt}"</span>
                         )}
                       </p>
                    </div>
                 </div>
                 <div className="w-full md:w-2/3 bg-black flex items-center justify-center">
                    <img src={look.lookImage} alt="Final Look" className="max-h-[70vh] w-auto object-contain" />
                 </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};