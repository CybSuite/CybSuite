'use client';

import * as DiceTagsInput from "@diceui/tags-input";
import { X, Trash } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as Kbd from '@/components/ui/kbd';

interface TagsInputProps {
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    className?: string;
    type?: 'text' | 'number';
    label?: string;
    required?: boolean;
    hasError?: boolean;
}

export function TagsInput({
    value,
    onChange,
    placeholder,
    className,
    type = 'text',
    label,
    required,
    hasError
}: TagsInputProps) {
    return (
        <DiceTagsInput.Root
            value={value}
            onValueChange={onChange}
            className={cn("flex w-full flex-col gap-2", className)}
            editable
        >
            {label && (
                <DiceTagsInput.Label className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </DiceTagsInput.Label>
            )}
            <div className={cn(
                "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:ring-1 focus-within:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-within:ring-zinc-400",
                hasError && "border-red-500"
            )}>
                {value.map((tag) => (
                    <DiceTagsInput.Item
                        key={tag}
                        value={tag}
                        className="inline-flex max-w-[calc(100%-8px)] items-center gap-1.5 rounded border bg-transparent px-2.5 py-1 text-sm focus:outline-hidden data-disabled:cursor-not-allowed data-editable:select-none data-editing:bg-transparent data-disabled:opacity-50 data-editing:ring-1 data-editing:ring-zinc-500 dark:data-editing:ring-zinc-400 [&:not([data-editing])]:pr-1.5 [&[data-highlighted]:not([data-editing])]:bg-zinc-200 [&[data-highlighted]:not([data-editing])]:text-black dark:[&[data-highlighted]:not([data-editing])]:bg-zinc-800 dark:[&[data-highlighted]:not([data-editing])]:text-white"
                    >
                        <DiceTagsInput.ItemText className="truncate" />
                        <DiceTagsInput.ItemDelete className="h-4 w-4 shrink-0 rounded-sm opacity-70 ring-offset-zinc-950 transition-opacity hover:opacity-100">
                            <X className="h-3.5 w-3.5" />
                        </DiceTagsInput.ItemDelete>
                    </DiceTagsInput.Item>
                ))}
                <DiceTagsInput.Input
                    placeholder={placeholder || "Add item..."}
                    className="flex-1 bg-transparent outline-hidden placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:placeholder:text-zinc-400"
                    type={type}
                />
            </div>
            <div className="flex items-center justify-between">
                {value.length > 0 && (
                    <DiceTagsInput.Clear className="flex h-9 w-fit items-center justify-center gap-2 rounded-sm border border-input bg-transparent p-2 text-zinc-800 shadow-xs hover:bg-zinc-100/80 dark:text-zinc-300 dark:hover:bg-zinc-900/80">
                        <Trash className="h-4 w-4" />
                    </DiceTagsInput.Clear>
                )}

                <span className="ml-auto text-xs text-gray-500">Press <Kbd.Root><Kbd.Key className="text-sm">↵</Kbd.Key></Kbd.Root> to add</span>
            </div>
        </DiceTagsInput.Root>
    );
}
