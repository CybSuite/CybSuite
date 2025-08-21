'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Check, ChevronsUpDown } from 'lucide-react';
import MultiSelect from '@/components/ui/multiCombobox';
import { DatePicker, DateTimePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import { TagsInput } from './TagsInput';
import { JSONEditor } from './JSONEditor';

export interface FormFieldOption {
    value: string | number;
    label: string;
}

export interface FormFieldConfig {
    name: string;
    type: string;
    label: string;
    required: boolean;
    nullable: boolean;
    description?: string;
    placeholder?: string;
    relation_entity?: string;
    multiple?: boolean;
    options?: FormFieldOption[];
    default?: any;
    min?: number;
    max?: number;
    step?: number;
    max_length?: number;
    min_length?: number;
    pattern?: string;
}

interface FormFieldRendererProps {
    fieldConfig: FormFieldConfig;
    value: any;
    onChange: (value: any) => void;
    error?: string;
    fieldOptions?: FormFieldOption[];
    onAddRelated?: (entity: string, targetField: string, isMultiple: boolean) => void;
    className?: string;
}

export function FormFieldRenderer({
    fieldConfig,
    value,
    onChange,
    error,
    fieldOptions = [],
    onAddRelated,
    className
}: FormFieldRendererProps) {
    const { name, type, label, required, placeholder } = fieldConfig;
    const hasError = !!error;
    const currentValue = value;

    return (
        <div className={cn("space-y-2", className)}>
            {/* Only show the top label for non-boolean fields */}
            {type !== 'boolean' && (
                <Label htmlFor={name}>
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </Label>
            )}

            {/* Relation and Enum fields - prioritize these first */}
            {(type === 'relation' || type === 'enum' || fieldConfig.relation_entity) && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        {fieldConfig.multiple ? (
                            <>
                                <MultiSelect
                                    options={(fieldOptions || fieldConfig.options || []).map(option => ({
                                        value: option.value.toString(),
                                        label: option.label
                                    }))}
                                    selected={(currentValue || []).map((v: any) => v?.toString())}
                                    onChange={(selected: string[]) => {
                                        // Convert string values back to original types
                                        const convertedValues = selected.map(v => {
                                            const option = (fieldOptions || fieldConfig.options || [])
                                                .find(opt => opt.value.toString() === v);
                                            return option ? option.value : v;
                                        });
                                        onChange(convertedValues);
                                    }}
                                    placeholder={placeholder || `Select ${label.toLowerCase()}...`}
                                    emptyText="No options found"
                                    className={cn("flex-grow w-auto", hasError && "border-red-500")}
                                />
                                {/* Show plus button only for relation fields (not enum fields) */}
                                {(type === 'relation' || fieldConfig.relation_entity) && onAddRelated && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onAddRelated(fieldConfig.relation_entity || '', name, fieldConfig.multiple || false)}
                                        className="h-6 w-6 p-0"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "flex-grow justify-between",
                                                !currentValue && "text-muted-foreground",
                                                hasError && "border-red-500"
                                            )}
                                        >
                                            {currentValue ? (() => {
                                                const option = (fieldOptions || fieldConfig.options || [])
                                                    .find(opt => opt.value?.toString() === currentValue?.toString());
                                                return option?.label || currentValue?.toString() || '';
                                            })() : (placeholder || `Select ${label.toLowerCase()}...`)}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                        <Command>
                                            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
                                            <CommandList>
                                                <CommandEmpty>No options found.</CommandEmpty>
                                                <CommandGroup>
                                                    {(fieldOptions || fieldConfig.options || []).map((option) => (
                                                        <CommandItem
                                                            key={option.value}
                                                            value={option.label}
                                                            onSelect={() => {
                                                                onChange(option.value !== currentValue ? option.value : (fieldConfig.nullable ? null : currentValue));
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    currentValue?.toString() === option.value?.toString() ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {option.label}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {/* Show plus button only for relation fields (not enum fields) */}
                                {(type === 'relation' || fieldConfig.relation_entity) && onAddRelated && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onAddRelated(fieldConfig.relation_entity || '', name, fieldConfig.multiple || false)}
                                        className="h-6 w-6 p-0"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* String input fields - use Textarea instead of Input for better UX */}
            {type === 'string' && (
                <Textarea
                    id={name}
                    placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                    value={currentValue === null || currentValue === undefined ? '' : currentValue}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
                    className={hasError ? 'border-red-500' : ''}
                    maxLength={fieldConfig.max_length}
                    minLength={fieldConfig.min_length}
                />
            )}

            {/* Text area fields */}
            {type === 'text' && (
                <Textarea
                    id={name}
                    placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                    value={currentValue === null || currentValue === undefined ? '' : currentValue}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
                    className={hasError ? 'border-red-500' : ''}
                    rows={1}
                />
            )}

            {/* Number input fields */}
            {(type === 'number' || type === 'integer' || type === 'float') && (
                <Input
                    id={name}
                    type="number"
                    placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                    value={currentValue === null || currentValue === undefined ? '' : currentValue}
                    onChange={(e) => {
                        const val = e.target.value;
                        const numVal = type === 'integer' ? parseInt(val) : parseFloat(val);
                        onChange(isNaN(numVal) ? '' : numVal);
                    }}
                    className={hasError ? 'border-red-500' : ''}
                    min={fieldConfig.min ? fieldConfig.min : undefined}
                    max={fieldConfig.max ? fieldConfig.max : undefined}
                    step={fieldConfig.step || (type === 'integer' ? 1 : 'any')}
                />
            )}

            {/* Boolean checkbox fields */}
            {type === 'boolean' && (
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id={name}
                        checked={currentValue || false}
                        onCheckedChange={(checked) => onChange(checked)}
                    />
                    <Label htmlFor={name} className="capitalize">
                        {/* Remove is_ prefix and capitalize */}
                        {label.toLowerCase().replace(/^is_/, '')}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                </div>
            )}

            {/* Tags input fields for string sequences */}
            {type === 'tags' && (
                <TagsInput
                    value={(() => {
                        if (Array.isArray(currentValue)) {
                            return currentValue;
                        } else if (typeof currentValue === 'string') {
                            try {
                                const parsed = JSON.parse(currentValue);
                                return Array.isArray(parsed) ? parsed : [];
                            } catch {
                                return [];
                            }
                        }
                        return [];
                    })()}
                    onChange={(tags) => onChange(tags)}
                    placeholder={placeholder || `Add ${label.toLowerCase()}...`}
                    hasError={hasError}
                    type="text"
                />
            )}

            {/* Number tags input fields for numeric sequences */}
            {type === 'number_tags' && (
                <TagsInput
                    value={(() => {
                        if (Array.isArray(currentValue)) {
                            return currentValue.map(String);
                        } else if (typeof currentValue === 'string') {
                            try {
                                const parsed = JSON.parse(currentValue);
                                return Array.isArray(parsed) ? parsed.map(String) : [];
                            } catch {
                                return [];
                            }
                        }
                        return [];
                    })()}
                    onChange={(tags) => onChange(tags.map(Number).filter(n => !isNaN(n)))}
                    placeholder={placeholder || `Add ${label.toLowerCase()}...`}
                    hasError={hasError}
                    type="number"
                />
            )}

            {/* Date picker fields */}
            {type === 'date' && (
                <DatePicker
                    date={currentValue ? new Date(currentValue) : undefined}
                    onDateChange={(date) => onChange(date ? date.toISOString().split('T')[0] : null)}
                    placeholder={placeholder || `Select ${label.toLowerCase()}`}
                    className={hasError ? 'border-red-500' : ''}
                />
            )}

            {/* DateTime picker fields */}
            {(type === 'datetime' || type === 'datetime-local') && (
                <DateTimePicker
                    date={currentValue ? new Date(currentValue) : undefined}
                    onDateChange={(date) => onChange(date ? date.toISOString() : null)}
                    placeholder={placeholder || `Select ${label.toLowerCase()}`}
                    className={hasError ? 'border-red-500' : ''}
                />
            )}

            {/* JSON editor fields */}
            {type === 'json' && (
                <JSONEditor
                    value={currentValue}
                    onChange={(json) => onChange(json)}
                    className={hasError ? 'border-red-500' : ''}
                    required={required}
                    hasError={hasError}
                />
            )}

            {hasError && (
                <p className="text-sm text-red-500">
                    {error}
                </p>
            )}
        </div>
    );
}
