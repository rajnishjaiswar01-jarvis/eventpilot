'use client';

import { useState, useRef } from 'react';
import { Download, Upload, FileJson, AlertTriangle, Check, X } from 'lucide-react';
import { useEventStore } from '@/lib/stores/event-store';
import { exportEventsToJSON, importEventsFromJSON, saveEvents } from '@/lib/stores/persistence';

export function DataManager() {
  const events = useEventStore((s) => s.events);
  const hydrate = useEventStore((s) => s.hydrate);
  const [importResult, setImportResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = exportEventsToJSON(events);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eventpilot-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const result = importEventsFromJSON(text);
      if (result.success) {
        const existingIds = new Set(events.map((ev) => ev.id));
        const newEvents = result.events.filter((ev) => !existingIds.has(ev.id));
        if (newEvents.length === 0 && result.events.length > 0) {
          setImportResult({ type: 'success', message: `All ${result.events.length} events already exist. No changes made.` });
        } else {
          saveEvents([...events, ...newEvents]);
          hydrate();
          setImportResult({
            type: 'success',
            message: `Imported ${newEvents.length} new event${newEvents.length !== 1 ? 's' : ''}.${result.events.length - newEvents.length > 0 ? ` ${result.events.length - newEvents.length} duplicate(s) skipped.` : ''}`,
          });
        }
      } else {
        setImportResult({ type: 'error', message: result.error });
      }
    };
    reader.onerror = () => {
      setImportResult({ type: 'error', message: 'Failed to read file' });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <FileJson className="w-4 h-4" />
        Data Management
      </h3>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleExport}
          disabled={events.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Export All Events
        </button>
        <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
          <Upload className="w-4 h-4" />
          Import Events
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="sr-only" />
        </label>
      </div>
      {importResult && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border ${importResult.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          {importResult.type === 'success' ? <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
          <p className={`text-sm ${importResult.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{importResult.message}</p>
          <button onClick={() => setImportResult(null)} className="ml-auto shrink-0"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Export creates a validated JSON file. Import validates before accepting — invalid events are skipped.</p>
    </div>
  );
}
