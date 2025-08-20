"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DatePickerProps {
	date?: Date;
	onDateChange: (date: Date | undefined) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export function DatePicker({
	date,
	onDateChange,
	placeholder = "Select date",
	disabled = false,
	className,
}: DatePickerProps) {
	const [open, setOpen] = React.useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className={cn(
						"w-full justify-between font-normal",
						!date && "text-muted-foreground",
						className
					)}
					disabled={disabled}
				>
					{date ? date.toLocaleDateString() : <span>{placeholder}</span>}
					<ChevronDownIcon className="h-4 w-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto overflow-hidden p-0" align="start">
				<Calendar
					mode="single"
					selected={date}
					captionLayout="dropdown"
					fromYear={1900}
					toYear={2100}
					onSelect={(selectedDate) => {
						onDateChange(selectedDate);
						setOpen(false);
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}

interface DateTimePickerProps {
	date?: Date;
	onDateChange: (date: Date | undefined) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export function DateTimePicker({
	date,
	onDateChange,
	placeholder = "Select date and time",
	disabled = false,
	className,
}: DateTimePickerProps) {
	const [open, setOpen] = React.useState(false);
	const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date);
	const [timeValue, setTimeValue] = React.useState<string>(
		date ? `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}` : "12:00"
	);

	React.useEffect(() => {
		setSelectedDate(date);
		if (date) {
			setTimeValue(`${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`);
		}
	}, [date]);

	const handleDateSelect = (newDate: Date | undefined) => {
		if (newDate) {
			// Parse the current time value
			const [hours, minutes] = timeValue.split(':').map(Number);
			const updatedDate = new Date(newDate);
			updatedDate.setHours(hours, minutes, 0, 0);

			setSelectedDate(updatedDate);
			onDateChange(updatedDate);
		} else {
			setSelectedDate(undefined);
			onDateChange(undefined);
		}
		setOpen(false);
	};

	const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newTimeValue = e.target.value;
		setTimeValue(newTimeValue);

		if (selectedDate) {
			const [hours, minutes] = newTimeValue.split(':').map(Number);
			const updatedDate = new Date(selectedDate);
			updatedDate.setHours(hours, minutes, 0, 0);

			setSelectedDate(updatedDate);
			onDateChange(updatedDate);
		}
	};

	const formatDateTime = (date: Date) => {
		const dateStr = date.toLocaleDateString();
		const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
		return `${dateStr} at ${timeStr}`;
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className={cn(
						"w-full justify-between font-normal",
						!selectedDate && "text-muted-foreground",
						className
					)}
					disabled={disabled}
				>
					{selectedDate ? formatDateTime(selectedDate) : <span>{placeholder}</span>}
					<ChevronDownIcon className="h-4 w-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto overflow-hidden p-0" align="start">
				<Calendar
					mode="single"
					selected={selectedDate}
					captionLayout="dropdown"
					fromYear={1900}
					toYear={2100}
					onSelect={handleDateSelect}
				/>
				<div className="p-3 border-t">
					<div className="flex items-center space-x-2">
						<label htmlFor="time-input" className="text-sm font-medium">
							Time:
						</label>
						<Input
							id="time-input"
							type="time"
							value={timeValue}
							onChange={handleTimeChange}
							className="w-fit max-w-full h-8"
						/>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
