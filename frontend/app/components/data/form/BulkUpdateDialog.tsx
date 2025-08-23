'use client';

import * as React from "react";
import { useForm, Controller, FieldValues } from "react-hook-form";
import { Loader2, Edit3, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/app/lib/api";
import { EntitySchema, FieldSchema } from "@/app/types/Data";
import { parseFieldAnnotation, getBulkUpdatableFields } from "@/app/lib/schema-utils";
import { FormFieldRenderer, type FormFieldOption } from '.';
import { convertFieldSchemaToFormFieldConfig } from "@/app/lib/forms-utils";

interface BulkUpdateDialogProps {
	entity: string;
	recordIds: (string | number)[];
	recordCount: number;
	schema?: EntitySchema;
	fieldOptions?: Record<string, FormFieldOption[]>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: (updatedCount: number) => void;
	customFieldOptionsEntityName?: string;
}

export function BulkUpdateDialog({
	entity,
	recordIds,
	recordCount,
	schema,
	fieldOptions = {},
	open,
	onOpenChange,
	onSuccess,
	customFieldOptionsEntityName
}: BulkUpdateDialogProps) {
	const [submitting, setSubmitting] = React.useState(false);
	const [generalError, setGeneralError] = React.useState<string>('');
	const [updatableFields, setUpdatableFields] = React.useState<FieldSchema[]>([]);
	const [loadedFieldOptions, setLoadedFieldOptions] = React.useState<Record<string, FormFieldOption[]>>({});

	const {
		control,
		handleSubmit,
		reset,
		formState: { errors },
		setError,
		clearErrors,
	} = useForm<FieldValues>({
		mode: 'onChange',
		defaultValues: {},
	});

	// Form height tracking for conditional top buttons
	const [showTopButtons, setShowTopButtons] = React.useState(false);
	const formRef = React.useRef<HTMLFormElement>(null);

	// Callback ref for more reliable form measurement
	const formCallbackRef = (element: HTMLFormElement | null) => {
		formRef.current = element;
		if (element && updatableFields.length > 0) {
			// Measure immediately when ref is set
			requestAnimationFrame(() => {
				if (element) {
					const formHeight = element.scrollHeight;
					setShowTopButtons(formHeight > 500);
				}
			});
		}
	};

	// Get bulk updatable fields when schema changes
	React.useEffect(() => {
		if (schema) {
			const fields = getBulkUpdatableFields(schema);
			setUpdatableFields(fields);

			// Set default values - all fields start empty for bulk update
			const defaultValues = fields.reduce((acc: any, field) => {
				const typeInfo = parseFieldAnnotation(field);

				// Set appropriate default based on field type
				if (typeInfo.isArray) {
					acc[field.name] = [];
				} else if (typeInfo.variant === 'boolean') {
					acc[field.name] = false;
				} else {
					acc[field.name] = '';
				}

				return acc;
			}, {});

			reset(defaultValues);
		}
	}, [schema, reset]);

	// Load field options for enum fields (similar to EntityFormDialog)
	React.useEffect(() => {
		const loadEnumFieldOptions = async () => {
			if (!schema || updatableFields.length === 0) return;

			// Find enum fields that need options loaded
			const enumFieldsNeedingOptions = updatableFields.filter(field => {
				// Check if it's an enum field (has choices) and we don't already have options for it
				return field.choices && Array.isArray(field.choices) && field.choices.length > 0 &&
					!fieldOptions[field.name] && !loadedFieldOptions[field.name];
			});

			if (enumFieldsNeedingOptions.length === 0) return;

			// Load options for enum fields
			const optionsPromises = enumFieldsNeedingOptions.map(async (field) => {
				try {
					const optionsResponse = await api.form.getFieldOptions(customFieldOptionsEntityName || entity, field.name);
					if (optionsResponse.error) {
						console.error(`Failed to load options for enum field ${field.name}:`, optionsResponse.error);
						return { fieldName: field.name, options: [] };
					}
					return { fieldName: field.name, options: optionsResponse.data.options };
				} catch (error) {
					console.error(`Failed to load options for enum field ${field.name}:`, error);
					return { fieldName: field.name, options: [] };
				}
			});

			const optionsResults = await Promise.all(optionsPromises);
			const optionsMap = optionsResults.reduce((acc, result) => {
				acc[result.fieldName] = result.options;
				return acc;
			}, {} as Record<string, FormFieldOption[]>);

			setLoadedFieldOptions(prev => ({ ...prev, ...optionsMap }));
		};

		loadEnumFieldOptions();
	}, [schema, updatableFields, entity, fieldOptions, loadedFieldOptions]);

	// Measure form height to determine if top buttons should be shown
	React.useEffect(() => {
		if (!open || updatableFields.length === 0) {
			setShowTopButtons(false);
			return;
		}

		// Function to measure form height
		const measureFormHeight = () => {
			if (formRef.current) {
				const formHeight = formRef.current.scrollHeight;
				setShowTopButtons(formHeight > 500);
				return true; // Successfully measured
			}
			return false; // Failed to measure
		};

		// Try to measure immediately
		if (measureFormHeight()) {
			return;
		}

		// If immediate measurement failed, use polling with timeout
		let attempts = 0;
		const maxAttempts = 50; // Max 5 seconds (50 * 100ms)

		const pollForForm = () => {
			attempts++;

			if (measureFormHeight()) {
				// Successfully measured, stop polling
				return;
			}

			if (attempts < maxAttempts) {
				setTimeout(pollForForm, 100);
			} else {
				// Fallback: assume we need top buttons if we have many fields
				const fieldCount = updatableFields.length;
				setShowTopButtons(fieldCount > 8);
			}
		};

		// Start polling after a short delay
		const timeoutId = setTimeout(pollForForm, 100);

		// Cleanup function
		return () => {
			clearTimeout(timeoutId);
		};
	}, [open, updatableFields]); // Remove formData dependency to avoid excessive re-renders

	const onSubmit = async (data: FieldValues) => {
		setSubmitting(true);
		clearErrors();
		setGeneralError('');

		try {
			// Only include fields that have been modified (non-empty values)
			const updateData: Record<string, any> = {};
			let hasUpdates = false;

			updatableFields.forEach(field => {
				const value = data[field.name];
				const typeInfo = parseFieldAnnotation(field);

				// Check if the field has a meaningful value to update
				let shouldInclude = false;

				if (typeInfo.variant === 'boolean') {
					// For boolean fields, always include the value
					shouldInclude = true;
				} else if (typeInfo.isArray) {
					// For array fields, include if not empty
					shouldInclude = Array.isArray(value) && value.length > 0;
				} else if (value !== null && value !== undefined && value !== '') {
					// For other fields, include if not empty
					shouldInclude = true;
				}

				if (shouldInclude) {
					updateData[field.name] = value;
					hasUpdates = true;
				}
			});

			if (!hasUpdates) {
				setGeneralError('Please provide at least one field to update.');
				return;
			}

			const response = await api.data.bulkUpdateRecords(entity, recordIds, updateData);

			if (response.error) {
				if (response.field_errors) {
					// Handle field-specific errors
					Object.entries(response.field_errors).forEach(([fieldName, fieldErrors]) => {
						setError(fieldName, {
							type: 'manual',
							message: Array.isArray(fieldErrors) ? fieldErrors[0] : String(fieldErrors)
						});
					});
				} else {
					setGeneralError(response.error);
				}
				return;
			}

			// Success - close dialog and notify parent
			reset({});
			clearErrors();
			setGeneralError('');
			onOpenChange(false);

			const updatedCount = response.data?.updated_count || 0;
			onSuccess?.(updatedCount);
		} catch (error) {
			console.error('Failed to bulk update records:', error);
			setGeneralError(
				error instanceof Error
					? error.message
					: 'An unexpected error occurred while updating the records.'
			);
		} finally {
			setSubmitting(false);
		}
	};

	const renderField = (field: FieldSchema) => {
		const fieldName = field.name;
		// Combine field options from props and loaded enum options
		const options = fieldOptions[fieldName] || loadedFieldOptions[fieldName] || [];

		// Convert FieldSchema to FormFieldConfig
		const formFieldConfig = convertFieldSchemaToFormFieldConfig(field, options);

		return (
			<Controller
				key={fieldName}
				name={fieldName}
				control={control}
				render={({ field: formField }) => (
					<FormFieldRenderer
						fieldConfig={formFieldConfig}
						value={formField.value}
						onChange={formField.onChange}
						error={errors[fieldName] ? String(errors[fieldName]?.message) : undefined}
						fieldOptions={options}
					/>
				)}
			/>
		);
	};

	const handleOpenChange = (newOpen: boolean) => {
		onOpenChange(newOpen);
		if (!newOpen) {
			// Reset form when dialog closes
			reset({});
			clearErrors();
			setGeneralError('');
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Edit3 className="h-5 w-5" />
						Bulk Update Records
					</DialogTitle>
					<DialogDescription>
						Update {recordCount} selected records in {entity}. Only non-unique, non-indexed fields are available for bulk updates to prevent constraint violations.
					</DialogDescription>
				</DialogHeader>

				{/* General error message - consistent with EntityFormDialog */}
				{generalError && (
					<div className="bg-red-50 border border-red-200 rounded-lg p-3">
						<p className="text-sm text-red-800">
							<strong>Error:</strong> {generalError}
						</p>
					</div>
				)}

				{/* Info message */}
				<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
					<div className="flex items-center gap-2 text-blue-800">
						<Info className="h-4 w-4" />
						<p className="text-sm">
							Only fields that you modify will be updated. Leave fields empty to skip updating them.
							{updatableFields.length === 0 && (
								<span className="block mt-1 font-medium text-amber-600">
									No updatable fields found for this entity. All fields may have unique/index constraints.
								</span>
							)}
						</p>
					</div>
				</div>

				{updatableFields.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">
						<AlertTriangle className="h-8 w-8 mx-auto mb-2" />
						<p>No fields available for bulk update</p>
						<p className="text-sm">All fields have unique or index constraints</p>
					</div>
				) : (
					<form ref={formCallbackRef} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
						{/* Top action buttons for convenience - only show if form is long */}
						{showTopButtons && (
							<div className="flex items-center justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => handleOpenChange(false)}
									disabled={submitting}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={submitting || updatableFields.length === 0}>
									{submitting ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											Updating...
										</>
									) : (
										`Update ${recordCount} Records`
									)}
								</Button>
							</div>
						)}

						{/* Form fields - consistent with EntityFormDialog */}
						{updatableFields.map(renderField)}

						{/* Footer buttons - consistent with EntityFormDialog */}
						<div className="flex justify-end space-x-2 pt-6 border-t">
							<Button
								type="button"
								variant="outline"
								onClick={() => handleOpenChange(false)}
								disabled={submitting}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={submitting || updatableFields.length === 0}>
								{submitting ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Updating...
									</>
								) : (
									`Update ${recordCount} Records`
								)}
							</Button>
						</div>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
