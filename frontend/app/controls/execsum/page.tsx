import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	AlertTriangle,
	Shield,
	CheckCircle,
	XCircle,
	TrendingUp,
	BarChart3,
	AlertCircle,
	Info,
	Zap,
	Clock,
	Pause,
	Play,
	CircleCheckBig
} from "lucide-react";
import { cn } from "@/lib/utils";
import ExecutiveSummaryActions from './ExecutiveSummaryActions';
import { api } from '@/app/lib/api';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";

// Simple Progress component
const Progress = ({ value, className }: { value: number; className?: string }) => (
	<div className={cn("w-full bg-gray-200 rounded-full h-2", className)}>
		<div
			className="bg-blue-600 h-2 rounded-full transition-all duration-300"
			style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
		/>
	</div>
);

// Severity styling utility
const getSeverityStyle = (severity: string) => {
	const lowerSeverity = (severity || '').toLowerCase();
	switch (lowerSeverity) {
		case 'critical':
			return {
				bg: 'bg-red-100',
				text: 'text-red-800',
				border: 'border-red-300',
				icon: 'text-red-600',
				ring: 'ring-red-200'
			};
		case 'high':
			return {
				bg: 'bg-orange-100',
				text: 'text-orange-800',
				border: 'border-orange-300',
				icon: 'text-orange-600',
				ring: 'ring-orange-200'
			};
		case 'medium':
			return {
				bg: 'bg-yellow-100',
				text: 'text-yellow-800',
				border: 'border-yellow-300',
				icon: 'text-yellow-600',
				ring: 'ring-yellow-200'
			};
		case 'low':
			return {
				bg: 'bg-green-100',
				text: 'text-green-800',
				border: 'border-green-300',
				icon: 'text-green-600',
				ring: 'ring-green-200'
			};
		case 'info':
			return {
				bg: 'bg-blue-100',
				text: 'text-blue-800',
				border: 'border-blue-300',
				icon: 'text-blue-600',
				ring: 'ring-blue-200'
			};
		default:
			return {
				bg: 'bg-gray-100',
				text: 'text-gray-800',
				border: 'border-gray-300',
				icon: 'text-gray-600',
				ring: 'ring-gray-200'
			};
	}
};

const SeverityIcon = ({ severity }: { severity: string }) => {
	const lowerSeverity = severity.toLowerCase();
	const style = getSeverityStyle(severity);

	switch (lowerSeverity) {
		case 'critical':
			return <AlertTriangle className={cn("h-4 w-4", style.icon)} />;
		case 'high':
			return <AlertCircle className={cn("h-4 w-4", style.icon)} />;
		case 'medium':
			return <Zap className={cn("h-4 w-4", style.icon)} />;
		case 'low':
			return <Info className={cn("h-4 w-4", style.icon)} />;
		case 'info':
			return <Info className={cn("h-4 w-4", style.icon)} />;
		default:
			return <Shield className={cn("h-4 w-4", style.icon)} />;
	}
};

const StatusIcon = ({ status }: { status: string }) => {
	switch (status.toLowerCase()) {
		case 'ok':
			return <CheckCircle className="h-4 w-4 text-green-600" />;
		case 'ko':
			return <XCircle className="h-4 w-4 text-red-600" />;
		case 'not_started':
			return <Play className="h-4 w-4 text-gray-600" />;
		case 'in_progress':
			return <Clock className="h-4 w-4 text-blue-600" />;
		case 'not_applicable':
			return <Pause className="h-4 w-4 text-gray-400" />;
		default:
			return <Info className="h-4 w-4 text-gray-600" />;
	}
};


const SeverityDistributionCard = ({
	title,
	controls,
	definitionSeverityData,
	occurrenceSeverityData,
	totalDefinitions,
	totalOccurrences,
	icon: Icon,
	type
}: {
	title: string;
	controls: any;
	definitionSeverityData: any;
	occurrenceSeverityData?: any;
	totalDefinitions: number;
	totalOccurrences: number;
	icon: React.ElementType;
	type: 'controls' | 'observations';
}) => {
	const severities = ['critical', 'high', 'medium', 'low', 'info', 'unknown'];
	const iconColor = type === 'controls' ? 'text-green-600' : 'text-red-600';

	// if no occurrence data is present, build it manually
	if (!occurrenceSeverityData) {
		occurrenceSeverityData = {
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
			info: 0,
			unknown: 0
		}

		// Build occurrence data manually
		controls.forEach((control: any) => {
			control.occurrences.forEach((occurrence: any) => {
				const severity = occurrence.severity || 'unknown';
				occurrenceSeverityData[severity]++;
			});
		});
	}

	// Calculate status distribution from occurrences
	const statusCounts: Record<string, number> = {
		ok: 0,
		ko: 0,
		in_progress: 0,
		not_started: 0,
		not_applicable: 0
	};

	controls.forEach((control: any) => {
		const statuses = control.occurrences.map((o: any) => o.status);
		let controlStatus;

		// 1. KO: at least one occurrence is 'ko'
		if (statuses.includes('ko')) {
			controlStatus = 'ko';
		}
		// 2. All occurrences are in one of the three specific statuses
		else if (statuses.every((s: string) => s === 'in_progress')) {
			controlStatus = 'in_progress';
		}
		else if (statuses.every((s: string) => s === 'not_started')) {
			controlStatus = 'not_started';
		}
		else if (statuses.every((s: string) => s === 'not_applicable')) {
			controlStatus = 'not_applicable';
		}
		// 3. Default: ok
		else {
			controlStatus = 'ok';
		}

		// Increment the corresponding counter
		statusCounts[controlStatus]++;
	});

	const statusOccurrences: number = Object.values(statusCounts).reduce((sum: number, count: unknown) => sum + (count as number), 0);
	const statuses = ['ok', 'ko', 'in_progress', 'not_started', 'not_applicable'];

	return (
		<Card className={type === "controls" ? "col-span-2" : ""}>
			<CardContent className="space-y-4 w-full">
				<div className="flex w-full gap-10">
					<div className="w-full">
						<CardHeader className="pl-0 pb-3">
							<CardTitle className="flex items-center gap-2 text-lg">
								<Icon className={cn("h-5 w-5", iconColor)} />
								{title}
							</CardTitle>
							<CardDescription>
								Distribution by {type === "controls" ? "default " : ""}severity level with occurrences
							</CardDescription>
						</CardHeader>
						<div className="flex justify-center">
							<div className="text-center flex flex-col items-center">
								<div className="text-2xl font-bold">{totalDefinitions.toLocaleString()}</div>
								<div className="w-fit flex items-center text-xs text-muted-foreground">
									{type === "controls" ? "Controls" : "Observations"}
									<HoverCard>
										<HoverCardTrigger asChild>
											<Info className="h-4 w-4 ml-1" />
										</HoverCardTrigger>
										<HoverCardContent className="w-fit">
											{controls.map((item: any, index: number) => (
												<div key={index} className="flex items-center justify-between py-1">
													<span className="text-sm font-medium">{item.name}</span>
													<Badge variant="outline" className="min-w-[2rem]text-sm text-muted-foreground ml-5">{item.total_occurrences}</Badge>
												</div>
											))}
										</HoverCardContent>
									</HoverCard>
								</div>
							</div>
						</div>
						<div className="mt-4 space-y-3">
							{severities.map((severity) => {
								const definitionCount = definitionSeverityData[severity] || 0;
								const definitionPercentage = totalDefinitions > 0 ? (definitionCount / totalDefinitions) * 100 : 0;
								const style = getSeverityStyle(severity);

								const occurrenceCount = occurrenceSeverityData && occurrenceSeverityData[severity] || 0;

								return (
									<div key={severity} className="flex items-center justify-between">
										<div className="flex items-center gap-2 min-w-0">
											<SeverityIcon severity={severity} />
											<span className="text-sm font-medium capitalize">
												{severity}
											</span>
										</div>
										<div className="flex items-center gap-3">
											<div className="w-20 mr-4">
												<Progress
													value={definitionPercentage}
													className="h-2"
												/>
											</div>
											{occurrenceSeverityData ? (
												<div className="grid grid-cols-[1fr_2rem_1fr] gap-1 min-w-[4rem] justify-end">
													<Badge
														variant="outline"
														className={cn("text-xs px-1 min-w-[2rem]",
															`${style.bg} ${style.text} ${style.border}`
														)}
													>
														{definitionCount}
													</Badge>
													<span className="text-center font-medium">|</span>
													<Badge
														variant="outline"
														className="text-xs px-1 min-w-[2rem]"
													>
														{occurrenceCount}
													</Badge>
												</div>
											) : (
												<Badge
													variant="outline"
													className={cn("text-xs px-1 min-w-[2rem]",
														`${style.bg} ${style.text} ${style.border}`
													)}
												>
													{definitionCount}
												</Badge>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</div>


					{type === "controls" && (
						<>
							<div className="bg-gray-300 w-1 h-[10rem] rounded self-center"></div>
							<div className="w-full">
								<CardHeader className="pl-0 pb-3">
									<CardTitle className="flex items-center gap-2 text-lg">
										<CircleCheckBig className={cn("h-5 w-5 text-purple-600")} />
										Status
									</CardTitle>
									<CardDescription>
										Distribution by status of controls
									</CardDescription>
								</CardHeader>

								<div className="space-y-3 mt-[4rem]">
									{statuses.map((status) => {
										const count = statusCounts[status] || 0;
										const percentage = statusOccurrences > 0 ? (count / statusOccurrences) * 100 : 0;

										return (
											<div key={status} className="flex items-center justify-between">
												<div className="flex items-center gap-2 min-w-0 flex-1">
													<StatusIcon status={status} />
													<span className="text-sm font-medium capitalize">
														{status.replace('_', ' ')}
													</span>
												</div>
												<div className="flex items-center gap-3">
													<div className="w-20">
														<Progress
															value={percentage}
															className="h-2"
														/>
													</div>
													<Badge
														variant="outline"
														className="text-xs min-w-[3rem] justify-center"
													>
														{count}
													</Badge>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

const TopControlsCard = ({ title, controls, type }: {
	title: string;
	controls: any[];
	type: 'controls' | 'observations';
}) => {
	const sortedControls = [...controls]
		.sort((a, b) => {
			// Sort by severity rank first, then by occurrences
			const severityRank: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1, undefined: 0 };
			const aRank = severityRank[a.max_severity?.toLowerCase() as keyof typeof severityRank] || 0;
			const bRank = severityRank[b.max_severity?.toLowerCase() as keyof typeof severityRank] || 0;

			if (aRank !== bRank) return bRank - aRank;
			return b.total_occurrences - a.total_occurrences;
		})
		.slice(0, 5);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<BarChart3 className="h-5 w-5 text-orange-600" />
						{title}
					</div>
					<ExecutiveSummaryActions type={type} />
				</CardTitle>
				<CardDescription>
					Ranked by severity and occurrence count
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{sortedControls.map((control, index) => {
						const style = getSeverityStyle(control.max_severity);
						const successRate = type === 'controls' && control.total_occurrences > 0
							? (control.total_status_ok / control.total_occurrences) * 100
							: 0;

						return (
							<div key={control.name} className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50/50">
								<div className="text-lg font-bold text-gray-500 min-w-[1.5rem]">
									{index + 1}
								</div>
								<div className="flex items-center gap-2">
									<SeverityIcon severity={control.max_severity} />
									<Badge
										variant="outline"
										className={cn("text-xs",
											`${style.bg} ${style.text} ${style.border}`
										)}
									>
										{control.max_severity}
									</Badge>
								</div>
								<div className="flex-1 min-w-0">
									<div className="font-medium text-sm truncate">
										{control.name}
									</div>
									<div className="text-xs text-gray-500 flex items-center gap-4">
										<span>{control.total_occurrences} occurrence{control.total_occurrences !== 1 ? 's' : ''}</span>
										{type === 'controls' && (
											<>
												<span>•</span>
												<span className={successRate >= 90 ? 'text-green-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}>
													{successRate.toFixed(1)}% success rate
												</span>
											</>
										)}
										{control.all_keys && control.all_keys.length > 0 && (
											<>
												<span>•</span>
												<span className="text-blue-600">
													{control.all_keys.length} key{control.all_keys.length !== 1 ? 's' : ''}
												</span>
											</>
										)}
									</div>
								</div>
								{type === 'controls' && control.status === 'ko' && (
									<XCircle className="h-4 w-4 text-red-500" />
								)}
								{type === 'controls' && control.status === 'ok' && (
									<CheckCircle className="h-4 w-4 text-green-500" />
								)}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
};

export default async function ExecutiveSummaryPage() {
	const { data: reportData, error } = await api.reports.getReportData('controls_json');

	if (error) {
		return (
			<div className="container mx-auto p-6 space-y-6">
				<div className="space-y-2">
					<h1 className="text-3xl font-bold tracking-tight">Executive Summary</h1>
					<p className="text-muted-foreground text-red-600">Error loading data: {error}</p>
				</div>
				<ExecutiveSummaryActions showRetry={true} />
			</div>
		);
	}

	if (!reportData) {
		return (
			<div className="container mx-auto p-6 space-y-6">
				<div className="space-y-2">
					<h1 className="text-3xl font-bold tracking-tight">Executive Summary</h1>
					<p className="text-muted-foreground">No data available</p>
				</div>
			</div>
		);
	}

	const { summary } = reportData;

	// Calculate overall security posture
	const totalObservations = summary.total_observations_occurrences;
	const totalControls = summary.total_control_occurrences;
	const securityScore = totalControls > 0 ? Math.max(0, ((totalControls - totalObservations) / totalControls) * 100) : 100;

	// Calculate risk level based on critical and high severity observations
	const highRiskCount = (summary.observations_occurrences_by_severity.critical || 0) +
		(summary.observations_occurrences_by_severity.high || 0);
	const riskLevel = highRiskCount > 10 ? 'High' : highRiskCount > 5 ? 'Medium' : 'Low';
	const riskColor = riskLevel === 'High' ? 'text-red-600' : riskLevel === 'Medium' ? 'text-yellow-600' : 'text-green-600';

	// Calculate success rate and n/a rate
	var successCount = 0;
	var naCount = 0;
	reportData.controls.forEach((control: any) => {
		control.occurrences.forEach((occ: any) => {
			const controlStatus = occ.status || 'unknown';
			if (controlStatus === 'ok') {
				successCount++;
			} else if (controlStatus === 'not_applicable') {
				naCount++;
			}
		});
	});

	const successRate = totalControls > 0 ? ((successCount / totalControls) * 100).toFixed(1) : 0;
	const naRate = totalControls > 0 ? ((naCount / totalControls) * 100).toFixed(1) : 0;

	return (
		<div className="container mx-auto p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<h1 className="text-3xl font-bold tracking-tight">Executive Summary</h1>
					<p className="text-muted-foreground">
						Security posture overview and key findings
					</p>
				</div>
				<ExecutiveSummaryActions showRefresh={true} showDownload={true} />
			</div>

			{/* Key Metrics Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Security Score</CardTitle>
						<TrendingUp className="h-4 w-4 text-blue-600" />
					</CardHeader>
					<CardContent className="flex">
						<Popover>
							<PopoverTrigger asChild className="mx-auto cursor-pointer">
								<Button variant="outline">Coming Soon</Button>
							</PopoverTrigger>
							<PopoverContent className="w-80">
								<div className="text-2xl font-bold">{securityScore.toFixed(1)}%</div>
								<Progress value={securityScore} className="mt-2" />
								<p className="text-xs text-muted-foreground mt-1">
									Theoretical score
								</p>
							</PopoverContent>
						</Popover>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Risk Level</CardTitle>
						<AlertTriangle className="h-4 w-4 text-orange-600" />
					</CardHeader>
					<CardContent>
						<div className={cn("text-2xl font-bold", riskColor)}>{riskLevel}</div>
						<p className="text-xs text-muted-foreground mt-1">
							{summary.total_observations_definitions} observations with {highRiskCount} occurrences
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Controls</CardTitle>
						<Shield className="h-4 w-4 text-green-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{summary.total_control_definitions}</div>
						<p className="text-xs text-muted-foreground mt-1">
							{successRate.toString()}% success rate - {naRate.toString()}% N/A rate
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Observations</CardTitle>
						<XCircle className="h-4 w-4 text-red-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-red-600">{summary.total_observations_definitions}</div>
						<p className="text-xs text-muted-foreground mt-1">
							{summary.total_observations_occurrences} total occurrences
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Status and Severity Distribution Charts */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<SeverityDistributionCard
					title="Controls"
					definitionSeverityData={summary.controls_definitions_by_severity}
					controls={reportData.controls}
					totalDefinitions={summary.total_control_definitions}
					totalOccurrences={summary.total_control_occurrences}
					icon={Shield}
					type="controls"
				/>

				<SeverityDistributionCard
					title="Observations"
					definitionSeverityData={summary.observations_definitions_by_severity}
					occurrenceSeverityData={summary.observations_occurrences_by_severity}
					controls={reportData.observations}
					totalDefinitions={summary.total_observations_definitions}
					totalOccurrences={summary.total_observations_occurrences}
					icon={XCircle}
					type="observations"
				/>
			</div>

			{/* Top Controls and Observations */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<TopControlsCard
					title="Top Control Occurrences"
					controls={reportData.controls}
					type="controls"
				/>

				<TopControlsCard
					title="Top Observation Occurrences"
					controls={reportData.observations}
					type="observations"
				/>
			</div>
		</div>
	);
}
