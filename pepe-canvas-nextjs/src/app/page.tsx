
"use client";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { fabric } from "fabric";
import { Download, ClipboardPaste, Upload, Type as TypeIcon, Trash2, Layers, ChevronUp, ChevronDown, BringToFront, SendToBack, ZoomIn, ZoomOut, Undo2, Redo2, Image as ImageIcon, Settings } from "lucide-react";

const PEPE_PACKS: Record<string, string[]> = {
  Classic: [
    "https://i.imgur.com/2u1U1bd.png",
    "https://i.imgur.com/VQwZ0pK.png",
    "https://i.imgur.com/1FOn8oV.png",
    "https://i.imgur.com/3m4QkIY.png",
    "https://i.imgur.com/Bm0yqjW.png",
  ],
  Emotes: [
    "https://i.imgur.com/7mYq2Qx.png",
    "https://i.imgur.com/3m3oQ5H.png",
    "https://i.imgur.com/0QyKz8V.png",
    "https://i.imgur.com/3lqfYd9.png",
  ],
};

const PRESETS = [
  { id: "1080p", w: 1920, h: 1080 },
  { id: "Square-1024", w: 1024, h: 1024 },
  { id: "Story-1080x1920", w: 1080, h: 1920 },
  { id: "Post-1200x630", w: 1200, h: 630 },
];

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [zoom, setZoom] = useState(1);
  const [bgColor, setBgColor] = useState<string>("#ffffff");
  const [transparentExport, setTransparentExport] = useState(false);
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 1200, h: 800 });
  const [textValue, setTextValue] = useState("Double‑click text to edit");
  const [tab, setTab] = useState<"stickers" | "text" | "import">("stickers");
  const [urlToAdd, setUrlToAdd] = useState("");

  useEffect(() => {
    if (!canvasRef.current) return;
    const f = new fabric.Canvas(canvasRef.current, {
      width: canvasSize.w,
      height: canvasSize.h,
      backgroundColor: bgColor,
      preserveObjectStacking: true,
      selection: true,
    });
    fabricRef.current = f;

    const trackSelection = () => {
      const obj = f.getActiveObject() as any;
      setActiveObjectId(obj?._uid ?? null);
    };
    f.on("selection:created", trackSelection);
    f.on("selection:updated", trackSelection);
    f.on("selection:cleared", () => setActiveObjectId(null));

    const record = () => pushHistory();
    f.on("object:added", record);
    f.on("object:modified", record);
    f.on("object:removed", record);

    drawGrid(f);

    return () => {
      f.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const f = fabricRef.current;
    if (!f) return;
    f.setDimensions({ width: canvasSize.w, height: canvasSize.h });
    drawGrid(f);
  }, [canvasSize]);

  useEffect(() => {
    const f = fabricRef.current;
    if (!f) return;
    f.setBackgroundColor(bgColor as any, () => f.requestRenderAll());
  }, [bgColor]);

  const serialize = () => {
    const f = fabricRef.current;
    if (!f) return "";
    return JSON.stringify(f.toJSON(["_uid"]));
  };
  const loadFrom = (json: string) => {
    const f = fabricRef.current;
    if (!f) return;
    f.loadFromJSON(json, () => {
      drawGrid(f);
      f.renderAll();
    });
  };
  const pushHistory = () => {
    const snap = serialize();
    if (!snap) return;
    setHistory((h) => [...h, snap]);
    setFuture([]);
  };
  const undo = () => {
    if (history.length < 2) return;
    const prev = history[history.length - 2];
    const curr = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [curr, ...f]);
    loadFrom(prev);
  };
  const redo = () => {
    if (!future.length) return;
    const [next, ...rest] = future;
    setFuture(rest);
    setHistory((h) => [...h, next]);
    loadFrom(next);
  };

  const addText = () => {
    const f = fabricRef.current;
    if (!f) return;
    const t = new fabric.IText(textValue, {
      left: f.getWidth()! / 2 - 100,
      top: f.getHeight()! / 2 - 20,
      fontFamily: "Inter, system-ui, Arial",
      fontSize: 48,
      fill: "#111827",
      editable: true,
    }) as any;
    t._uid = randomId();
    f.add(t);
    f.setActiveObject(t);
    f.requestRenderAll();
  };

  const addImageFromUrl = async (url: string) => {
    const f = fabricRef.current;
    if (!f || !url) return;
    try {
      fabric.Image.fromURL(url + (url.includes("?") ? "&" : "?") + "cacheBust=" + Date.now(), (img: any) => {
        const scale = Math.min(1, Math.min((f.getWidth()! * 0.6) / img.width!, (f.getHeight()! * 0.6) / img.height!));
        img.scale(scale);
        img.set({ left: (f.getWidth()! - img.getScaledWidth()) / 2, top: (f.getHeight()! - img.getScaledHeight()) / 2 });
        img._uid = randomId();
        f.add(img);
        f.setActiveObject(img);
        f.requestRenderAll();
      }, { crossOrigin: "anonymous" });
    } catch (e) {
      console.error(e);
    }
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addImageFromUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeActive = () => {
    const f = fabricRef.current;
    const obj = f?.getActiveObject();
    if (f && obj) {
      f.remove(obj);
      setActiveObjectId(null);
      f.requestRenderAll();
    }
  };

  const bringForward = () => {
    const f = fabricRef.current;
    const obj = f?.getActiveObject();
    if (f && obj) {
      f.bringForward(obj);
      f.requestRenderAll();
    }
  };
  const sendBackwards = () => {
    const f = fabricRef.current;
    const obj = f?.getActiveObject();
    if (f && obj) {
      f.sendBackwards(obj);
      f.requestRenderAll();
    }
  };
  const bringToFrontFn = () => {
    const f = fabricRef.current;
    const obj = f?.getActiveObject();
    if (f && obj) {
      f.bringToFront(obj);
      f.requestRenderAll();
    }
  };
  const sendToBackFn = () => {
    const f = fabricRef.current;
    const obj = f?.getActiveObject();
    if (f && obj) {
      f.sendToBack(obj);
      f.requestRenderAll();
    }
  };

  const exportPNG = () => {
    const f = fabricRef.current;
    if (!f) return;
    let dataUrl: string;
    if (transparentExport) {
      const prev = f.backgroundColor;
      f.setBackgroundColor(undefined as any, () => {});
      dataUrl = f.toDataURL({ format: "png" });
      f.setBackgroundColor(prev as any, () => {});
    } else {
      dataUrl = f.toDataURL({ format: "png" });
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `pepe-canvas-${Date.now()}.png`;
    a.click();
  };

  const zoomBy = (delta: number) => {
    const f = fabricRef.current;
    if (!f) return;
    const next = Math.min(4, Math.max(0.25, zoom + delta));
    setZoom(next);
    f.setZoom(next);
    f.requestRenderAll();
  };

  const layerItems = useMemo(() => {
    const f = fabricRef.current;
    if (!f) return [] as any[];
    return f.getObjects() as any[];
  }, [history, activeObjectId]);

  function drawGrid(f: fabric.Canvas) {
    f.backgroundImage = undefined as any;
    if (!showGrid) return;
    const gridSize = 40;
    const gridCanvas = document.createElement("canvas");
    gridCanvas.width = gridSize;
    gridCanvas.height = gridSize;
    const ctx = gridCanvas.getContext("2d")!;
    (ctx as any).fillStyle = bgColor;
    ctx.fillRect(0, 0, gridSize, gridSize);
    (ctx as any).strokeStyle = "#e5e7eb";
    (ctx as any).lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gridSize + 0.5, 0);
    ctx.lineTo(gridSize + 0.5, gridSize);
    ctx.moveTo(0, gridSize + 0.5);
    ctx.lineTo(gridSize, gridSize + 0.5);
    ctx.stroke();
    const pattern = new (fabric as any).Pattern({ source: gridCanvas, repeat: "repeat" });
    f.setBackgroundColor(pattern as any, () => f.requestRenderAll());
  }

  useEffect(() => {
    const f = fabricRef.current;
    if (!f) return;
    drawGrid(f);
  }, [showGrid, bgColor]);

  const randomId = () => Math.random().toString(36).slice(2, 9);

  return (
    <div className="min-h-screen w-full bg-white">
      <header className="border-b sticky top-0 z-10 bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          <div className="text-xl font-bold">Pepe Canvas</div>
          <div className="ml-auto flex items-center gap-2">
            <button className="px-3 py-2 border rounded" onClick={() => undo()}><span className="inline-flex items-center gap-1"><Undo2 className="w-4 h-4"/>Undo</span></button>
            <button className="px-3 py-2 border rounded" onClick={() => redo()}><span className="inline-flex items-center gap-1"><Redo2 className="w-4 h-4"/>Redo</span></button>
            <button className="px-3 py-2 rounded bg-black text-white" onClick={exportPNG}><span className="inline-flex items-center gap-1"><Download className="w-4 h-4"/>Export PNG</span></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-12 gap-4 p-4">
        {/* Sidebar */}
        <aside className="col-span-3">
          <div className="mb-4 border rounded-2xl">
            <div className="px-4 py-3 border-b font-medium flex items-center gap-2"><Settings className="w-4 h-4"/>Canvas</div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <select className="w-full border rounded px-2 py-2" onChange={(e) => {
                  const p = PRESETS.find(x => x.id === e.target.value);
                  if (p) setCanvasSize({ w: p.w, h: p.h });
                }}>
                  <option>Preset size</option>
                  {PRESETS.map(p => <option key={p.id} value={p.id}>{p.id} ({p.w}×{p.h})</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm w-24">BG color</label>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 rounded"/>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)}/> Grid
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={transparentExport} onChange={(e) => setTransparentExport(e.target.checked)}/> Transparent export
              </label>
              <div className="flex items-center gap-2">
                <button className="px-3 py-2 border rounded" onClick={() => zoomBy(-0.1)}><ZoomOut className="w-4 h-4"/></button>
                <div className="text-sm w-20 text-center">{Math.round(zoom*100)}%</div>
                <button className="px-3 py-2 border rounded" onClick={() => zoomBy(+0.1)}><ZoomIn className="w-4 h-4"/></button>
              </div>
            </div>
          </div>

          <div className="border rounded-2xl">
            <div className="px-4 py-3 border-b font-medium">Add elements</div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-1 mb-3">
                <button className={`px-2 py-2 border rounded ${tab==='stickers'?'bg-black text-white':''}`} onClick={() => setTab('stickers')}>Stickers</button>
                <button className={`px-2 py-2 border rounded ${tab==='text'?'bg-black text-white':''}`} onClick={() => setTab('text')}>Text</button>
                <button className={`px-2 py-2 border rounded ${tab==='import'?'bg-black text-white':''}`} onClick={() => setTab('import')}>Import</button>
              </div>

              {tab === 'stickers' && (
                <div className="h-[360px] pr-2 overflow-auto">
                  {Object.entries(PEPE_PACKS).map(([pack, urls]) => (
                    <div key={pack} className="mb-4">
                      <div className="font-medium mb-2">{pack}</div>
                      <div className="grid grid-cols-3 gap-2">
                        {urls.map((u, idx) => (
                          <button key={idx} className="border rounded-lg overflow-hidden hover:ring" onClick={() => addImageFromUrl(u)}>
                            <img src={u} alt="pepe" className="w-full h-20 object-contain bg-white"/>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'text' && (
                <div className="space-y-3">
                  <input className="w-full border rounded px-2 py-2" value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Your text"/>
                  <button className="px-3 py-2 border rounded inline-flex items-center gap-1" onClick={addText}><TypeIcon className="w-4 h-4"/>Add text</button>
                </div>
              )}

              {tab === 'import' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input className="flex-1 border rounded px-2 py-2" value={urlToAdd} onChange={(e) => setUrlToAdd(e.target.value)} placeholder="Paste image URL"/>
                    <button className="px-3 py-2 border rounded inline-flex items-center gap-1" onClick={() => addImageFromUrl(urlToAdd)}><ClipboardPaste className="w-4 h-4"/>Add</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input className="w-full border rounded px-2 py-2" type="file" accept="image/*" onChange={onUpload}/>
                    <Upload className="w-4 h-4"/>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Canvas Area */}
        <section className="col-span-6">
          <div className="rounded-2xl border bg-neutral-50 p-4 overflow-auto" style={{ height: "72vh" }}>
            <div className="mx-auto w-fit shadow-inner bg-white">
              <canvas ref={canvasRef} />
            </div>
          </div>
        </section>

        {/* Layers / Inspector */}
        <aside className="col-span-3">
          <div className="border rounded-2xl">
            <div className="px-4 py-3 border-b font-medium flex items-center justify-between">
              <span className="inline-flex items-center gap-2"><Layers className="w-4 h-4"/>Layers</span>
              <div className="flex items-center gap-1">
                <button className="p-2" onClick={bringForward} title="Bring forward"><ChevronUp className="w-4 h-4"/></button>
                <button className="p-2" onClick={sendBackwards} title="Send backward"><ChevronDown className="w-4 h-4"/></button>
                <button className="p-2" onClick={bringToFrontFn} title="Bring to front"><BringToFront className="w-4 h-4"/></button>
                <button className="p-2" onClick={sendToBackFn} title="Send to back"><SendToBack className="w-4 h-4"/></button>
                <button className="p-2" onClick={removeActive} title="Delete"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
            <div className="p-3 h-[520px] overflow-auto">
              {layerItems.map((obj: any, i: number) => (
                <div
                  key={obj._uid || i}
                  onClick={() => {
                    const f = fabricRef.current!;
                    f.setActiveObject(obj);
                    f.requestRenderAll();
                    setActiveObjectId(obj._uid ?? null);
                  }}
                  className={`flex items-center justify-between px-2 py-2 mb-2 rounded-xl border hover:bg-neutral-50 cursor-pointer ${activeObjectId === obj._uid ? "ring-2 ring-neutral-400" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {obj.type === "image" ? <ImageIcon className="w-4 h-4"/> : <TypeIcon className="w-4 h-4"/>}
                    <div className="text-sm truncate max-w-[140px]">{obj.type === "image" ? "Image" : (obj.text?.slice(0, 18) || "Text")}</div>
                  </div>
                  <div className="text-xs text-neutral-500">{Math.round(obj.left)}, {Math.round(obj.top)}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <footer className="py-4 text-center text-xs text-neutral-500">Built with Next.js, Tailwind & Fabric.js. Images are demo; replace with your own pack.</footer>
    </div>
  );
}
