"use client";

import React, { useState, useEffect } from 'react';
import { LookEditor } from '@/components/LookEditor';
import { MODELS, SCENES ,AppStep, Look, Lookbook } from './type';

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
  // Global State
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  
  // Navigation State
  const [activeLookbookId, setActiveLookbookId] = useState<string | null>(null);
  const [activeLookId, setActiveLookId] = useState<string | null>(null);

  // UI State for Lookbook creation
  const [isCreatingLB, setIsCreatingLB] = useState(false);
  const [newLBTitle, setNewLBTitle] = useState('');

  // Check API Key on mount
  useEffect(() => {
    async function checkApiKey() {
      if (window.aistudio) {
        const hasSelected = await window.aistudio.hasSelectedApiKey();
        setHasKey(hasSelected);
      } else {
        setHasKey(true);
      }
    }
    checkApiKey();
  }, []);

  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  // Helpers
  const getActiveLookbook = () => lookbooks.find(lb => lb.id === activeLookbookId);
  const getActiveLook = () => getActiveLookbook()?.looks.find(l => l.id === activeLookId);

  // Lookbook Actions
  const createLookbook = () => {
    if (!newLBTitle.trim()) return;
    const newLB: Lookbook = {
      id: crypto.randomUUID(),
      title: newLBTitle,
      description: 'Collection of fashion looks',
      createdAt: Date.now(),
      looks: []
    };
    setLookbooks([newLB, ...lookbooks]);
    setNewLBTitle('');
    setIsCreatingLB(false);
  };

  const deleteLookbook = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this lookbook and all its looks?')) {
      setLookbooks(prev => prev.filter(lb => lb.id !== id));
      if (activeLookbookId === id) setActiveLookbookId(null);
    }
  };

  // Look Actions
  const createLook = () => {
    if (!activeLookbookId) return;
    const newLook: Look = {
      id: crypto.randomUUID(),
      name: `Look ${(getActiveLookbook()?.looks.length || 0) + 1}`,
      status: 'draft',
      updatedAt: Date.now(),
      step: AppStep.UPLOAD,
      uploadedImages: [],
      collageImage: null,
      selectedModel: MODELS[0].id,
      selectedScene: SCENES[0].id,
      lookImage: null
    };
    
    setLookbooks(prev => prev.map(lb => {
      if (lb.id === activeLookbookId) {
        return { ...lb, looks: [newLook, ...lb.looks] };
      }
      return lb;
    }));
    setActiveLookId(newLook.id);
  };

  const updateLook = (updatedLook: Look) => {
    setLookbooks(prev => prev.map(lb => {
      if (lb.id === activeLookbookId) {
        return {
          ...lb,
          looks: lb.looks.map(l => l.id === updatedLook.id ? updatedLook : l)
        };
      }
      return lb;
    }));
  };

  const deleteLook = (lookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this look?')) return;
    
    setLookbooks(prev => prev.map(lb => {
      // Robustly find the lookbook containing this look and remove it
      if (lb.looks.some(l => l.id === lookId)) {
         return { ...lb, looks: lb.looks.filter(l => l.id !== lookId) };
      }
      return lb;
    }));
  };

  // Render API Key Selection Screen
  if (!hasKey) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center text-zinc-200 font-sans">
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-8 shadow-xl shadow-indigo-900/50">S</div>
        <h1 className="text-4xl font-bold text-white mb-4">StyleForge AI</h1>
        <p className="text-zinc-400 max-w-md mb-10 text-lg leading-relaxed">
          Please connect a Google Cloud Project with billing enabled to access professional features.
        </p>
        <button onClick={handleConnectKey} className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all flex items-center gap-3">
          Connect API Key
        </button>
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="mt-8 text-sm text-zinc-600 hover:text-zinc-400 underline">
          Billing & Usage Info
        </a>
      </div>
    );
  }

  // View: Look Editor
  if (activeLookbookId && activeLookId) {
    const look = getActiveLook();
    const lb = getActiveLookbook();
    if (look && lb) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-200">
          <LookEditor 
            look={look} 
            lookbookTitle={lb.title}
            onUpdate={updateLook} 
            onBack={() => setActiveLookId(null)} 
          />
        </div>
      );
    }
  }

  // View: Lookbook Detail (List of Looks)
  if (activeLookbookId) {
    const lb = getActiveLookbook();
    if (!lb) return null;
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <header className="border-b border-zinc-800 sticky top-0 bg-zinc-950 z-30">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <button onClick={() => setActiveLookbookId(null)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
               </button>
               <h1 className="text-xl font-bold text-white">{lb.title}</h1>
               <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">{lb.looks.length} Looks</span>
            </div>
            <button 
              onClick={createLook}
              className="bg-white text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors"
            >
              + Create New Look
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
           {lb.looks.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-zinc-700">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.077-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.048 4.025a3 3 0 01-4.293 0l-1.414-1.415a3 3 0 010-4.293l1.414-1.414L9 10.5l-1.414 1.414a3 3 0 01-4.293 0l-1.414-1.414a3 3 0 010-4.293l1.414-1.414a3 3 0 014.293 0L6 6.293l1.414-1.414a3 3 0 014.293 0L13.12 6.293l1.414-1.414a3 3 0 014.293 0l1.414 1.414a3 3 0 010 4.293L18 12.12l1.414-1.414a3 3 0 014.293 0l1.414 1.414a3 3 0 010 4.293l-1.414 1.414a3 3 0 01-4.293 0l-1.414-1.414-1.414 1.414a3 3 0 01-4.293 0l-1.414-1.414z" />
                  </svg>
                </div>
                <p className="text-lg font-medium mb-2">This Lookbook is empty</p>
                <p className="max-w-xs text-center mb-6">Start by creating your first fashion look in this collection.</p>
                <button onClick={createLook} className="text-indigo-400 hover:text-indigo-300 font-medium">Create Look</button>
             </div>
           ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {lb.looks.map(look => (
                  <div 
                    key={look.id} 
                    onClick={() => setActiveLookId(look.id)}
                    className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden cursor-pointer hover:border-zinc-600 transition-all hover:shadow-xl hover:shadow-black/50"
                  >
                     <div className="aspect-[3/4] bg-zinc-950 relative">
                        {look.lookImage ? (
                          <img src={look.lookImage} className="w-full h-full object-cover" alt="Final" />
                        ) : look.collageImage ? (
                          <img src={look.collageImage} className="w-full h-full object-cover" alt="Collage" />
                        ) : look.uploadedImages.length > 0 ? (
                           <div className="w-full h-full p-4 grid grid-cols-2 gap-2">
                              {look.uploadedImages.slice(0, 4).map(img => (
                                <img key={img.id} src={img.previewUrl} className="w-full h-full object-cover rounded bg-white" alt="Item" />
                              ))}
                           </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700">
                             Empty
                          </div>
                        )}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                           <button 
                             onClick={(e) => deleteLook(look.id, e)}
                             className="p-1.5 bg-black/60 hover:bg-red-900/80 text-white rounded-md backdrop-blur"
                           >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                           </button>
                        </div>
                     </div>
                     <div className="p-4">
                        <h3 className="text-white font-medium truncate">{look.name}</h3>
                        <div className="flex justify-between items-center mt-2">
                           <span className="text-xs text-zinc-500">
                             {new Date(look.updatedAt).toLocaleDateString()}
                           </span>
                           <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                             look.status === 'completed' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                           }`}>
                             {look.status}
                           </span>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </main>
      </div>
    );
  }

  // View: Dashboard (Lookbooks)
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white">S</div>
            <span className="font-semibold text-xl tracking-tight text-white">StyleForge AI</span>
          </div>
          <button 
            onClick={() => setIsCreatingLB(true)}
            className="bg-white text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            New Lookbook
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-10">
        <div className="flex items-end justify-between mb-8">
           <div>
              <h1 className="text-3xl font-bold text-white mb-2">My Lookbooks</h1>
              <p className="text-zinc-400">Manage your fashion collections and storyboards.</p>
           </div>
        </div>

        {isCreatingLB && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8 animate-fade-in">
             <h3 className="text-lg font-medium text-white mb-4">Create New Collection</h3>
             <div className="flex gap-4">
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Collection Title (e.g., Summer 2025 Campaign)"
                  className="flex-1 bg-black border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                  value={newLBTitle}
                  onChange={(e) => setNewLBTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createLookbook()}
                />
                <button onClick={createLookbook} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">Create</button>
                <button onClick={() => setIsCreatingLB(false)} className="px-6 py-2 text-zinc-400 hover:text-white">Cancel</button>
             </div>
          </div>
        )}

        {lookbooks.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl">
             <p className="text-zinc-500 mb-4">No lookbooks yet.</p>
             <button onClick={() => setIsCreatingLB(true)} className="text-indigo-400 hover:text-indigo-300 font-medium">Create your first collection</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lookbooks.map(lb => (
              <div 
                key={lb.id} 
                onClick={() => setActiveLookbookId(lb.id)}
                className="group bg-zinc-900 border border-zinc-800 rounded-xl p-6 cursor-pointer hover:border-zinc-600 transition-all hover:shadow-xl hover:shadow-indigo-900/10"
              >
                <div className="flex justify-between items-start mb-4">
                   <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 group-hover:text-indigo-400 group-hover:bg-indigo-900/20 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                      </svg>
                   </div>
                   <button 
                     onClick={(e) => deleteLookbook(lb.id, e)}
                     className="text-zinc-600 hover:text-red-400 p-2"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                </div>
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-300 transition-colors">{lb.title}</h3>
                <p className="text-zinc-500 text-sm mb-6">{lb.description}</p>
                <div className="flex items-center gap-4 text-xs font-medium text-zinc-400">
                   <span className="flex items-center gap-1.5">
                     <span className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-indigo-500"></span>
                     {lb.looks.length} Looks
                   </span>
                   <span>•</span>
                   <span>Created {new Date(lb.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;