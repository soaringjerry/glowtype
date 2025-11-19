import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, RotateCcw, Key, Globe, Cpu } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { apiKey, baseUrl, model, updateSettings } = useSettings();
    const [localSettings, setLocalSettings] = useState({ apiKey, baseUrl, model });

    useEffect(() => {
        if (isOpen) {
            setLocalSettings({ apiKey, baseUrl, model });
        }
    }, [isOpen, apiKey, baseUrl, model]);

    const handleSave = () => {
        updateSettings(localSettings);
        onClose();
    };

    const handleReset = () => {
        setLocalSettings({
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-3.5-turbo',
        });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                            <h2 className="text-lg font-semibold text-slate-900">API Settings</h2>
                            <button
                                onClick={onClose}
                                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6 p-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <Globe size={16} className="text-sky-500" />
                                    API Endpoint (Base URL)
                                </label>
                                <input
                                    type="text"
                                    value={localSettings.baseUrl}
                                    onChange={(e) => setLocalSettings({ ...localSettings, baseUrl: e.target.value })}
                                    placeholder="https://api.openai.com/v1"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                                />
                                <p className="text-xs text-slate-500">
                                    The base URL for the API. Compatible with OpenAI-style endpoints.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <Key size={16} className="text-amber-500" />
                                    API Key
                                </label>
                                <input
                                    type="password"
                                    value={localSettings.apiKey}
                                    onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                                    placeholder="sk-..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                                />
                                <p className="text-xs text-slate-500">
                                    Your API key is stored locally in your browser and sent directly to the API.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <Cpu size={16} className="text-violet-500" />
                                    Model Name
                                </label>
                                <input
                                    type="text"
                                    value={localSettings.model}
                                    onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value })}
                                    placeholder="gpt-3.5-turbo"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            >
                                <RotateCcw size={16} />
                                Reset
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-2 text-sm font-medium text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400 active:scale-95"
                            >
                                <Save size={16} />
                                Save Changes
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
