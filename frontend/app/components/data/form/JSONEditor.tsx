'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface JSONEditorProps {
    value: any;
    onChange: (value: any) => void;
    className?: string;
    required?: boolean;
    placeholder?: string;
    hasError?: boolean;
}

export function JSONEditor({
    value,
    onChange,
    className,
    required = false,
    placeholder,
    hasError
}: JSONEditorProps) {
    const [jsonString, setJsonString] = useState(() => {
        if (value === null || value === undefined) {
            return required ? '{}' : '';
        }
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return required ? '{}' : '';
        }
    });
    const [internalHasError, setInternalHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value.trim();
        setJsonString(e.target.value);

        // Handle empty value
        if (newValue === '') {
            if (required) {
                setInternalHasError(true);
                setErrorMessage('This field is required');
            } else {
                setInternalHasError(false);
                setErrorMessage('');
                onChange(null);
            }
            return;
        }

        try {
            const parsed = JSON.parse(newValue);
            setInternalHasError(false);
            setErrorMessage('');
            onChange(parsed);
        } catch (error) {
            setInternalHasError(true);
            setErrorMessage(error instanceof Error ? error.message : 'Invalid JSON syntax');
        }
    };

    // Auto-resize textarea based on content
    const adjustHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.max(200, textareaRef.current.scrollHeight) + 'px';
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [jsonString]);

    const lineCount = Math.max(1, jsonString.split('\n').length);
    const lineNumberWidth = Math.max(30, String(lineCount).length * 8 + 20);

    const showError = hasError || internalHasError;

    return (
        <div className={cn("border rounded-md overflow-hidden", className, showError && "border-red-500")}>
            <div className="bg-gray-50 px-3 py-2 border-b text-sm font-medium text-gray-700 flex items-center justify-between">
                <span>JSON Editor</span>
                {!showError && jsonString.trim() !== '' && (
                    <span className="text-green-600 text-xs">✓ Valid JSON</span>
                )}
                {!showError && jsonString.trim() === '' && !required && (
                    <span className="text-gray-500 text-xs">Empty (optional)</span>
                )}
            </div>
            <div className="relative">
                {/* Line numbers */}
                <div
                    className="absolute left-0 top-0 p-3 pointer-events-none text-gray-400 font-mono text-sm select-none bg-gray-50 border-r"
                    style={{ width: lineNumberWidth, lineHeight: '1.5' }}
                >
                    {Array.from({ length: lineCount }, (_, i) => (
                        <div key={i}>{i + 1}</div>
                    ))}
                </div>
                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={jsonString}
                    onChange={handleChange}
                    onInput={adjustHeight}
                    className={cn(
                        "w-full p-3 font-mono text-sm border-none resize-none focus:outline-none focus:ring-0",
                        "bg-white min-h-[200px]",
                        showError ? 'bg-red-50' : ''
                    )}
                    placeholder={placeholder || (required ? "Enter valid JSON..." : "Enter valid JSON or leave empty...")}
                    style={{
                        lineHeight: '1.5',
                        tabSize: 2,
                        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                        paddingLeft: lineNumberWidth + 'px',
                    }}
                />
            </div>
            {showError && errorMessage && (
                <div className="p-2 bg-red-50 border-t border-red-200 text-sm text-red-600">
                    <strong>JSON Error:</strong> {errorMessage}
                </div>
            )}
        </div>
    );
}
