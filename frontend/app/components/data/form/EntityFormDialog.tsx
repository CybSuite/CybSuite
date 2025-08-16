'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, Controller, FieldValues } from 'react-hook-form';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Edit } from 'lucide-react';
import { api } from '@/app/lib/api';
import { FormFieldRenderer, type FormFieldConfig, type FormFieldOption } from '.';

// Nested Entity Form Component - simplified form without dialog wrapper
interface NestedEntityFormProps {
	entity: string;
	onSuccess: (createdRecord: any) => void;
	onCancel: () => void;
}

function NestedEntityForm({ entity, onSuccess, onCancel }: NestedEntityFormProps) {
	const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
	const [fieldOptions, setFieldOptions] = useState<Record<string, FormFieldOption[]>>({});
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const {
		control,
		handleSubmit,
		reset,
		setError,
	} = useForm<FieldValues>({
		mode: 'onChange',
		defaultValues: {},
	});

	useEffect(() => {
		loadFormSchema();
	}, [entity]);

	const loadFormSchema = async () => {
		setLoading(true);
		try {
			const schemaResponse = await api.form.getFormSchema(entity);
			if (schemaResponse.error) {
				throw new Error(schemaResponse.error);
			}
			const schema = schemaResponse.data;
			setFormSchema(schema);

			// Initialize field options from schema-provided options
			const schemaOptions: Record<string, FormFieldOption[]> = {};
			schema.fields.forEach((field: FormFieldConfig) => {
				if (field.options) {
					schemaOptions[field.name] = field.options;
				}
			});
			setFieldOptions(schemaOptions);

			// Set default values
			const defaultValues = schema.fields.reduce((acc: any, field: FormFieldConfig) => {
				if (field.default !== undefined && field.default !== null && field.default !== "NOTHING") {
					acc[field.name] = field.default;
				} else if (field.type === 'boolean') {
					acc[field.name] = false;
				} else if (field.multiple) {
					acc[field.name] = [];
				}
				return acc;
			}, {});
			reset(defaultValues);

		} catch (error) {
			console.error('Failed to load form schema:', error);
		} finally {
			setLoading(false);
		}
	};

	// Helper function to check if the entity has dict fields
	const hasJsonFields = () => {
		return formSchema?.fields.some(field => field.type === 'json') || false;
	};

	const onSubmit = async (data: FieldValues) => {
		setSubmitting(true);

		try {
			// Clean up form data before submission (same logic as main form)
			const cleanData = { ...data };

			formSchema?.fields.forEach(field => {
				if (field.type === 'tags' || field.type === 'number_tags') {
					if (Array.isArray(cleanData[field.name])) {
						if (cleanData[field.name].length > 0) {
							cleanData[field.name] = JSON.stringify(cleanData[field.name]);
						} else {
							delete cleanData[field.name];
						}
					} else {
						delete cleanData[field.name];
					}
				}
				else if (Array.isArray(cleanData[field.name]) && !field.multiple) {
					cleanData[field.name] = cleanData[field.name][0] || null;
				}

				if (field.type === 'relation' && cleanData[field.name] !== null && cleanData[field.name] !== undefined) {
					const fieldValue = cleanData[field.name];
					if (field.multiple) {
						cleanData[field.name] = Array.isArray(fieldValue)
							? fieldValue.map(v => {
								const numValue = Number(v);
								return !isNaN(numValue) ? numValue : v;
							})
							: fieldValue;
					} else {
						const numValue = Number(fieldValue);
						cleanData[field.name] = !isNaN(numValue) ? numValue : fieldValue;
					}
				}
			});

			const response = await api.data.createRecord(entity, cleanData);
			if (response.error) {
				// Handle different types of error responses from the backend
				if (response.field_errors) {
					// Field-specific validation errors - set individual field errors
					Object.entries(response.field_errors).forEach(([field, errors]) => {
						const errorMessage = Array.isArray(errors) ? errors[0] : String(errors);
						setError(field, { message: errorMessage || 'Invalid value' });
					});
				} else {
					// General error - this is the simplified form so just log it
					console.error('Failed to create record:', response.error);
				}
				return; // Don't call onSuccess on error
			}

			// Check if the entity has JSON/dict fields that might affect column structure
			const entityHasJsonFields = hasJsonFields();

			if (entityHasJsonFields) {
				// For entities with dict/JSON fields, reload the page to rebuild flattened column structure
				// This ensures that new dict data is properly flattened into separate columns in the table
				setTimeout(() => {
					window.location.reload();
				}, 100); // Small delay to ensure any pending operations complete
			} else {
				// For entities without dict fields, just call the success callback
				onSuccess(response.data);
			}
		} catch (error) {
			console.error('Failed to create record:', error);
		} finally {
			setSubmitting(false);
		}
	};

	// Simplified renderField function using shared FormFieldRenderer (no nested dialogs)
	const renderField = (fieldConfig: FormFieldConfig) => {
		return (
			<Controller
				key={fieldConfig.name}
				name={fieldConfig.name}
				control={control}
				rules={{
					required: fieldConfig.required ? `${fieldConfig.label} is required` : false,
				}}
				render={({ field, fieldState }) => (
					<FormFieldRenderer
						fieldConfig={fieldConfig}
						value={field.value}
						onChange={field.onChange}
						error={fieldState.error?.message}
						fieldOptions={fieldOptions[fieldConfig.name] || fieldConfig.options}
					// No onAddRelated callback for nested forms to avoid infinite nesting
					/>
				)}
			/>
		);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="h-6 w-6 animate-spin" />
				<span className="ml-2">Loading form...</span>
			</div>
		);
	}

	if (!formSchema) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				Failed to load form schema. Please try again.
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			{formSchema.fields.map(renderField)}

			<div className="flex justify-end space-x-2 pt-4">
				<Button
					type="button"
					variant="outline"
					onClick={onCancel}
					disabled={submitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={submitting}>
					{submitting ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Creating...
						</>
					) : (
						'Create'
					)}
				</Button>
			</div>
		</form>
	);
}

interface FormSchema {
	entity: string;
	fields: FormFieldConfig[];
	required_fields: string[];
}

interface EntityFormDialogProps {
	entity: string;
	triggerLabel?: string;
	initialFormSchema?: FormSchema;
	initialFieldOptions?: Record<string, FormFieldOption[]>;
	onSuccess?: (createdRecord?: any) => void;
	// Edit mode props
	mode?: 'create' | 'edit';
	editRecord?: any;
	recordId?: string | number;
	// External dialog control props
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function EntityFormDialog({
	entity,
	triggerLabel,
	initialFormSchema,
	initialFieldOptions = {},
	onSuccess,
	mode = 'create',
	editRecord,
	recordId,
	open: externalOpen,
	onOpenChange: externalOnOpenChange
}: EntityFormDialogProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
	const [fieldOptions, setFieldOptions] = useState<Record<string, FormFieldOption[]>>({});

	// Use external open state if provided, otherwise use internal state
	const open = externalOpen !== undefined ? externalOpen : internalOpen;
	const setOpen = externalOnOpenChange || setInternalOpen;
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [generalError, setGeneralError] = useState<string>('');

	const {
		handleSubmit,
		reset,
		formState: { errors },
		setError,
		clearErrors,
		setValue,
		watch,
	} = useForm<FieldValues>({
		mode: 'onChange',
		defaultValues: {},
	});

	// Form height tracking for conditional top buttons
	const [showTopButtons, setShowTopButtons] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);

	// Callback ref for more reliable form measurement
	const formCallbackRef = (element: HTMLFormElement | null) => {
		formRef.current = element;
		if (element && formSchema) {
			// Measure immediately when ref is set
			requestAnimationFrame(() => {
				if (element) {
					const formHeight = element.scrollHeight;
					setShowTopButtons(formHeight > 500);
				}
			});
		}
	};

	// Nested dialog state for creating related entities
	const [nestedDialog, setNestedDialog] = useState<{
		isOpen: boolean;
		entity: string;
		targetField: string;
		isMultiple: boolean;
	}>({
		isOpen: false,
		entity: '',
		targetField: '',
		isMultiple: false,
	});
	// Load form schema when dialog opens
	useEffect(() => {
		if (open && !formSchema) {
			if (initialFormSchema) {
				setFormSchema(initialFormSchema);
				// Merge initial field options with schema-provided options

				const combinedOptions = { ...initialFieldOptions };
				initialFormSchema.fields.forEach((field: FormFieldConfig) => {
					if (field.options && (!combinedOptions[field.name] || combinedOptions[field.name].length === 0)) {
						combinedOptions[field.name] = field.options;
					}
				});
				setFieldOptions(combinedOptions);
				setDefaultValues(initialFormSchema);
			} else {
				loadFormSchema();
			}
		}
	}, [open, entity, initialFormSchema, initialFieldOptions]);

	// Measure form height to determine if top buttons should be shown
	useEffect(() => {
		if (!open || !formSchema) {
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
				const fieldCount = formSchema?.fields?.length || 0;
				setShowTopButtons(fieldCount > 8);
			}
		};

		// Start polling after a short delay
		const timeoutId = setTimeout(pollForForm, 100);

		// Cleanup function
		return () => {
			clearTimeout(timeoutId);
		};
	}, [open, formSchema]); // Remove formData dependency to avoid excessive re-renders

	const setDefaultValues = (schema: FormSchema) => {
		let initialValues: any = {};

		if (mode === 'edit' && editRecord) {
			// For edit mode, start with the existing record data
			initialValues = { ...editRecord };

			// Process the existing data to match form expectations
			schema.fields.forEach(field => {
				const fieldValue = initialValues[field.name];

				// Handle relation fields - extract ID from {id, repr} objects
				if (field.type === 'relation' || field.relation_entity) {
					if (field.multiple && Array.isArray(fieldValue)) {
						// For many-to-many relations, extract IDs from array of objects
						initialValues[field.name] = fieldValue.map(item =>
							(typeof item === 'object' && item !== null && 'id' in item) ? item.id : item
						);
					} else if (fieldValue && typeof fieldValue === 'object' && 'id' in fieldValue) {
						// For single relations, extract ID from object
						initialValues[field.name] = fieldValue.id;
					}
					// If fieldValue is already an ID (number/string), keep it as is
				}

				// Handle tags and number_tags fields - parse JSON strings back to arrays
				else if (field.type === 'tags' || field.type === 'number_tags') {
					if (typeof fieldValue === 'string') {
						try {
							const parsed = JSON.parse(fieldValue);
							initialValues[field.name] = Array.isArray(parsed) ? parsed : [];
						} catch {
							initialValues[field.name] = [];
						}
					} else if (!Array.isArray(fieldValue)) {
						initialValues[field.name] = [];
					}
				}

				// Handle date and datetime fields - ensure proper format
				else if (field.type === 'date' || field.type === 'datetime' || field.type === 'datetime-local') {
					if (fieldValue && typeof fieldValue === 'string') {
						// Keep the ISO string format for the form
						initialValues[field.name] = fieldValue;
					} else if (fieldValue instanceof Date) {
						// Convert Date object to ISO string
						initialValues[field.name] = fieldValue.toISOString();
					} else {
						// Clear invalid date values
						initialValues[field.name] = null;
					}
				}

				// Handle boolean fields
				else if (field.type === 'boolean') {
					initialValues[field.name] = Boolean(fieldValue);
				}

				// Handle multiple select fields
				else if (field.multiple && !Array.isArray(fieldValue)) {
					initialValues[field.name] = fieldValue ? [fieldValue] : [];
				}

				// Handle empty/null values
				else if (fieldValue === null || fieldValue === undefined) {
					if (field.type === 'boolean') {
						initialValues[field.name] = false;
					} else if (field.multiple) {
						initialValues[field.name] = [];
					} else {
						initialValues[field.name] = '';
					}
				}
			});
		} else {
			// For create mode, use default values from schema
			initialValues = schema.fields.reduce((acc: any, field: FormFieldConfig) => {
				// Only set valid default values, skip "NOTHING", null, or undefined
				if (field.default !== undefined && field.default !== null && field.default !== "NOTHING") {
					acc[field.name] = field.default;
				} else if (field.type === 'boolean') {
					acc[field.name] = false;
				} else if (field.multiple) {
					acc[field.name] = [];
				}
				// For other field types, don't set any default value (leave undefined)
				return acc;
			}, {});
		}

		reset(initialValues);
	};

	const loadFormSchema = async () => {
		setLoading(true);
		try {
			const schemaResponse = await api.form.getFormSchema(entity);
			if (schemaResponse.error) {
				throw new Error(schemaResponse.error);
			}
			const schema = schemaResponse.data;
			setFormSchema(schema);
			setDefaultValues(schema);

			// Initialize field options from schema-provided options
			const schemaOptions: Record<string, FormFieldOption[]> = {};
			schema.fields.forEach((field: FormFieldConfig) => {
				if (field.options) {
					schemaOptions[field.name] = field.options;
				}
			});
			setFieldOptions(schemaOptions);

			// Load options for relation and enum fields that don't have multiple
			await loadFieldOptions(schema);
		} catch (error) {
			console.error('Failed to load form schema:', error);
		} finally {
			setLoading(false);
		}
	};

	const loadFieldOptions = async (schema: FormSchema) => {
		// Skip loading if we already have preloaded options
		const fieldsNeedingOptions = schema.fields.filter(
			(field: FormFieldConfig) =>
				(field.type === 'relation' || field.type === 'enum' || field.relation_entity) &&
				!field.options &&
				!fieldOptions[field.name] // Don't reload if we already have options
		);

		if (fieldsNeedingOptions.length === 0) {
			return; // All options are already available
		}

		const optionsPromises = fieldsNeedingOptions.map(async (field: FormFieldConfig) => {
			try {
				let optionsResponse;

				// For relation fields, use the data options endpoint with the related entity
				if (field.type === 'relation' && field.relation_entity) {
					optionsResponse = await api.data.getEntityOptions(field.relation_entity);
					if (optionsResponse.error || !optionsResponse.data) {
						console.error(`Failed to load options for relation field ${field.name}:`, optionsResponse.error);
						return { fieldName: field.name, options: [] };
					}
					// Convert the response format from {id, repr} to {value, label}
					// Ensure the ID is properly handled as the value
					const options = optionsResponse.data.map((item: any) => ({
						value: item.id, // Keep as number if it's a number, don't convert to string here
						label: item.repr
					}));
					return { fieldName: field.name, options };
				} else {
					// For enum fields, use the form options endpoint
					optionsResponse = await api.form.getFieldOptions(entity, field.name);
					if (optionsResponse.error) {
						console.error(`Failed to load options for field ${field.name}:`, optionsResponse.error);
						return { fieldName: field.name, options: [] };
					}
					return { fieldName: field.name, options: optionsResponse.data.options };
				}
			} catch (error) {
				console.error(`Failed to load options for field ${field.name}:`, error);
				return { fieldName: field.name, options: [] };
			}
		});

		const optionsResults = await Promise.all(optionsPromises);
		const optionsMap = optionsResults.reduce((acc, result) => {
			acc[result.fieldName] = result.options;
			return acc;
		}, {} as Record<string, FormFieldOption[]>);

		setFieldOptions(prev => ({ ...prev, ...optionsMap }));
	};

	const validateForm = (data: FieldValues) => {
		if (!formSchema) return false;

		let isValid = true;
		clearErrors();

		formSchema.fields.forEach((field) => {
			const value = data[field.name];

			// Required field validation
			if (field.required) {
				if (value === undefined || value === null || value === '' ||
					(Array.isArray(value) && value.length === 0)) {
					setError(field.name, { type: 'required', message: `${field.label} is required` });
					isValid = false;
					return;
				}
			}

			// Type-specific validation
			if (value !== undefined && value !== null && value !== '') {
				switch (field.type) {
					case 'string':
					case 'text':
						if (typeof value === 'string') {
							if (field.min_length && value.length < field.min_length) {
								setError(field.name, { type: 'minLength', message: `${field.label} must be at least ${field.min_length} characters` });
								isValid = false;
							}
							if (field.max_length && value.length > field.max_length) {
								setError(field.name, { type: 'maxLength', message: `${field.label} must be no more than ${field.max_length} characters` });
								isValid = false;
							}
							if (field.pattern && !new RegExp(field.pattern).test(value)) {
								setError(field.name, { type: 'pattern', message: `${field.label} format is invalid` });
								isValid = false;
							}
						}
						break;
					case 'number':
					case 'integer':
					case 'float':
						if (typeof value === 'number') {
							if (field.min !== undefined && field.min !== null && value < field.min) {
								setError(field.name, { type: 'min', message: `${field.label} must be at least ${field.min}` });
								isValid = false;
							}
							if (field.max !== undefined && field.max !== null && value > field.max) {
								setError(field.name, { type: 'max', message: `${field.label} must be no more than ${field.max}` });
								isValid = false;
							}
						}
						break;
					case 'tags':
						if (Array.isArray(value)) {
							if (field.min_length && value.length < field.min_length) {
								setError(field.name, { type: 'minLength', message: `${field.label} must have at least ${field.min_length} items` });
								isValid = false;
							}
							if (field.max_length && value.length > field.max_length) {
								setError(field.name, { type: 'maxLength', message: `${field.label} must have no more than ${field.max_length} items` });
								isValid = false;
							}
						}
						break;
					case 'number_tags':
						if (Array.isArray(value)) {
							if (field.min_length && value.length < field.min_length) {
								setError(field.name, { type: 'minLength', message: `${field.label} must have at least ${field.min_length} items` });
								isValid = false;
							}
							if (field.max_length && value.length > field.max_length) {
								setError(field.name, { type: 'maxLength', message: `${field.label} must have no more than ${field.max_length} items` });
								isValid = false;
							}
							// Validate each number in the array
							if (value.some(v => typeof v !== 'number' || isNaN(v))) {
								setError(field.name, { type: 'pattern', message: `${field.label} must contain only valid numbers` });
								isValid = false;
							}
						}
						break;
					case 'date':
					case 'datetime':
					case 'datetime-local':
						// Basic date validation - check if it's a valid date string
						if (typeof value === 'string') {
							const date = new Date(value);
							if (isNaN(date.getTime())) {
								setError(field.name, { type: 'pattern', message: `${field.label} must be a valid date` });
								isValid = false;
							}
						}
						break;
					case 'json':
						// JSON validation is handled by the JSON editor component
						break;
				}
			}
		});

		return isValid;
	};

	// Helper function to check if the entity has dict fields
	const hasJsonFields = () => {
		return formSchema?.fields.some(field => field.type === 'json') || false;
	};

	const onSubmit = async (data: FieldValues) => {
		if (!validateForm(data)) {
			return;
		}

		setSubmitting(true);
		// Clear any previous errors
		clearErrors();
		setGeneralError('');

		try {
			// Start with an empty clean data object and only include fields from the form schema
			const cleanData: Record<string, any> = {};

			// Only include fields that are defined in the form schema (excludes is_linked_by_related_name fields)
			formSchema?.fields.forEach(field => {
				const fieldValue = data[field.name];

				// Handle tags and number_tags fields - they should be stringified JSON
				if (field.type === 'tags' || field.type === 'number_tags') {
					if (Array.isArray(fieldValue)) {
						// Only include tags fields that are not empty
						if (fieldValue.length > 0) {
							// Convert array to stringified JSON for Django JSON field
							cleanData[field.name] = JSON.stringify(fieldValue);
						}
						// If empty, don't include the field at all
					}
					// If it's not an array, don't include it
				}
				// For other fields that are arrays but not multiple, take the first element
				else if (Array.isArray(fieldValue) && !field.multiple) {
					cleanData[field.name] = fieldValue[0] || null;
				}
				// For relation fields, ensure we're sending the proper ID values
				else if (field.type === 'relation' && fieldValue !== null && fieldValue !== undefined) {
					// Convert string IDs back to numbers if they were originally numbers
					if (field.multiple) {
						// For multiple values, convert each string ID to number if possible
						cleanData[field.name] = Array.isArray(fieldValue)
							? fieldValue.map(v => {
								const numValue = Number(v);
								return !isNaN(numValue) ? numValue : v;
							})
							: fieldValue;
					} else {
						// For single values, convert string ID to number if possible
						const numValue = Number(fieldValue);
						cleanData[field.name] = !isNaN(numValue) ? numValue : fieldValue;
					}
				}
				// For all other fields, include them as-is if they have a value
				else if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
					cleanData[field.name] = fieldValue;
				}
			});

			let response;
			if (mode === 'edit' && recordId) {
				// For edit mode, include the ID in the request body
				cleanData.id = recordId;
				// Include pretty_id if it exists in the original edit record
				if (editRecord?.pretty_id) {
					cleanData.pretty_id = editRecord.pretty_id;
				}
				// Update existing record
				response = await api.data.updateRecord(entity, recordId, cleanData);
			} else {
				// Create new record
				response = await api.data.createRecord(entity, cleanData);
			}

			if (response.error) {
				// Handle different types of error responses from the backend
				if (response.field_errors) {
					// Field-specific validation errors - set errors using react-hook-form
					Object.entries(response.field_errors).forEach(([field, errors]) => {
						if (Array.isArray(errors)) {
							setError(field, { type: 'server', message: errors[0] || 'Invalid value' });
						} else {
							setError(field, { type: 'server', message: String(errors) });
						}
					});
					setGeneralError(response.error || 'Please correct the field errors below.');
				} else if (response.details) {
					// General error with details
					setGeneralError(Array.isArray(response.details) ? response.details.join('. ') : response.details);
				} else {
					// Simple error message
					setGeneralError(response.error);
				}
				return; // Don't close dialog on error
			}

			// Reset form
			reset({});
			clearErrors();
			setGeneralError('');
			setOpen(false);

			// Check if the entity has JSON/dict fields that might affect column structure
			const entityHasJsonFields = hasJsonFields();

			if (entityHasJsonFields) {
				// For entities with dict/JSON fields, reload the page to rebuild flattened column structure
				// This ensures that new dict data is properly flattened into separate columns in the table
				setTimeout(() => {
					window.location.reload();
				}, 100); // Small delay to ensure dialog closes first
			} else {
				// For entities without dict fields, just call the success callback
				onSuccess?.(response.data);
			}
		} catch (error) {
			console.error(`Failed to ${mode} record:`, error);
			// Handle network or other unexpected errors
			setGeneralError(
				error instanceof Error
					? error.message
					: `An unexpected error occurred while ${mode === 'edit' ? 'updating' : 'creating'} the record.`
			);
		} finally {
			setSubmitting(false);
		}
	};

	const handleFieldChange = (fieldName: string, value: any) => {
		setValue(fieldName, value);
		// Clear error when user starts typing
		const fieldError = errors[fieldName];
		if (fieldError) {
			clearErrors(fieldName);
		}
	};

	// Nested dialog functions
	const openNestedDialog = (entity: string, targetField: string, isMultiple: boolean) => {
		setNestedDialog({
			isOpen: true,
			entity,
			targetField,
			isMultiple,
		});
	};

	const closeNestedDialog = () => {
		setNestedDialog({
			isOpen: false,
			entity: '',
			targetField: '',
			isMultiple: false,
		});
	};

	const handleNestedEntityCreated = async (newRecord: any) => {
		// Close the nested dialog
		closeNestedDialog();

		// Create option object for the new record
		const newOption = {
			value: newRecord.id,
			label: newRecord.repr || newRecord.name || `${nestedDialog.entity} #${newRecord.id}`
		};

		// Add the new option to the field options
		setFieldOptions(prev => ({
			...prev,
			[nestedDialog.targetField]: [
				...(prev[nestedDialog.targetField] || []),
				newOption
			]
		}));

		// Update the form data based on field type
		if (nestedDialog.isMultiple) {
			// For multiple select, add to existing selection
			const currentValue = watch(nestedDialog.targetField) || [];
			handleFieldChange(nestedDialog.targetField, [...currentValue, newRecord.id]);
		} else {
			// For single select, set as the selected value
			handleFieldChange(nestedDialog.targetField, newRecord.id);
		}
	};

	const renderField = (fieldConfig: FormFieldConfig) => {
		const hasError = errors[fieldConfig.name];
		const currentValue = watch(fieldConfig.name);

		return (
			<div key={fieldConfig.name} className="space-y-2">
				<FormFieldRenderer
					fieldConfig={fieldConfig}
					value={currentValue}
					onChange={(value) => handleFieldChange(fieldConfig.name, value)}
					error={hasError ? (typeof hasError === 'string' ? hasError : (hasError as any)?.message || 'Invalid value') : undefined}
					fieldOptions={fieldOptions[fieldConfig.name] || fieldConfig.options}
					onAddRelated={(relationEntity: string, fieldName: string, multiple: boolean) =>
						openNestedDialog(relationEntity, fieldName, multiple)
					}
				/>
			</div>
		);
	};

	const handleOpenChange = (newOpen: boolean) => {
		setOpen(newOpen);
		if (!newOpen) {
			// Reset form when closing
			reset({});
			clearErrors();
			setGeneralError('');
			if (!initialFormSchema) {
				setFormSchema(null);
				setFieldOptions({});
			}
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				{/* Only show trigger button when not externally controlled */}
				{externalOpen === undefined && (
					<DialogTrigger asChild>
						<Button variant="default" size="lg">
							{mode === 'edit' ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
							{triggerLabel || (mode === 'edit' ? `Edit ${entity}` : `Add ${entity}`)}
						</Button>
					</DialogTrigger>
				)}
				<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{mode === 'edit' ? `Edit ${entity}` : `Add New ${entity}`}
						</DialogTitle>
						<DialogDescription>
							{mode === 'edit'
								? `Update the ${entity} record details below.`
								: `Fill out the form below to create a new ${entity} record.`
							}
						</DialogDescription>
					</DialogHeader>

					{loading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
							<span className="ml-2">Loading form...</span>
						</div>
					) : formSchema ? (
						<form ref={formCallbackRef} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
							{/* Top action buttons for convenience - only show if form is long */}
							{showTopButtons && (
								<div className="flex items-center justify-end gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => setOpen(false)}
										disabled={submitting}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={submitting}>
										{submitting ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												{mode === 'edit' ? 'Updating...' : 'Creating...'}
											</>
										) : (
											mode === 'edit' ? 'Update' : 'Create'
										)}
									</Button>
								</div>
							)}

							{/* General error message */}
							{generalError && (
								<div className="bg-red-50 border border-red-200 rounded-lg p-3">
									<p className="text-sm text-red-800">
										<strong>Error:</strong> {generalError}
									</p>
								</div>
							)}

							{formSchema.fields.map(renderField)}

							<div className="flex justify-end space-x-2 pt-6 border-t">
								<Button
									type="button"
									variant="outline"
									onClick={() => setOpen(false)}
									disabled={submitting}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={submitting}>
									{submitting ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											{mode === 'edit' ? 'Updating...' : 'Creating...'}
										</>
									) : (
										mode === 'edit' ? 'Update' : 'Create'
									)}
								</Button>
							</div>
						</form>
					) : (
						<div className="text-center py-8 text-muted-foreground">
							Failed to load form schema. Please try again.
						</div>
					)}
				</DialogContent>
			</Dialog>
			{/* Nested form for creating related entities */}
			{nestedDialog.isOpen && (
				<Dialog open={nestedDialog.isOpen} onOpenChange={(open) => !open && closeNestedDialog()}>
					<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>Create New {nestedDialog.entity}</DialogTitle>
							<DialogDescription>
								Create a new {nestedDialog.entity} record to select for the {nestedDialog.targetField} field.
							</DialogDescription>
						</DialogHeader>
						<NestedEntityForm
							entity={nestedDialog.entity}
							onSuccess={handleNestedEntityCreated}
							onCancel={closeNestedDialog}
						/>
					</DialogContent>
				</Dialog>
			)}
		</>
	);
}
