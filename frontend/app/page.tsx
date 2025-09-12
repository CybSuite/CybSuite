import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Shield,
	Activity,
	FolderDot,
	Server,
	AlertTriangle,
	AlertCircle,
	TrendingUp,
	Upload,
	List,
	Search,
	TableProperties,
	Radar,
	XCircle,
	ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { getApiBaseUrl } from './lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface HomepageData {
	execsum: {
		highest_observation?: {
			severity: string;
			title: string;
			id: number;
		} | null;
		control_count: number;
		observation_count: number;
		control_definition_count: number;
		error?: string;
		total_control_definitions: number;
		total_observations_definitions: number;
		total_control_occurrences: number;
		total_observations_occurrences: number;
		observations_occurrences_by_severity: {
			critical?: number;
			high?: number;
			medium?: number;
			low?: number;
			info?: number;
			unknown?: number;
		};
		observations_definitions_by_severity: {
			critical?: number;
			high?: number;
			medium?: number;
			low?: number;
			info?: number;
			unknown?: number;
		};
		controls?: any[];
	};
	ad: {
		domain_count: number;
		ad_user_count: number;
		ad_computer_count: number;
		top_domains?: {
			name: string;
			id: number;
			pretty_id: string;
			users_count: number;
			computers_count: number;
		}[] | null;
		error?: string;
	};
	pentest: {
		host_count: number;
		service_count: number;
		password_count: number;
		dns_count: number;
		top_services_by_port: Array<{
			service: string;
			count: number;
		}>;
		top_services_by_name: Array<{
			service: string;
			count: number;
		}>;
		error?: string;
	};
}

async function getHomepageData(): Promise<HomepageData> {
	try {
		const response = await fetch(`${getApiBaseUrl()}/api/v1/homepage/`);

		if (!response.ok) {
			throw new Error('Failed to fetch homepage data');
		}

		return response.json();
	} catch (error) {
		console.error('Error fetching homepage data:', error);
		// Return mock data for development
		return {
			execsum: {
				highest_observation: null,
				control_count: 0,
				observation_count: 0,
				control_definition_count: 0,
				error: "Unable to load executive summary data",
				total_control_definitions: 0,
				total_observations_definitions: 0,
				total_control_occurrences: 0,
				total_observations_occurrences: 0,
				observations_occurrences_by_severity: {
					critical: 0,
					high: 0,
					medium: 0,
					low: 0,
					info: 0,
					unknown: 0
				},
				observations_definitions_by_severity: {
					critical: 0,
					high: 0,
					medium: 0,
					low: 0,
					info: 0,
					unknown: 0
				},
				controls: [],
			},
			ad: {
				domain_count: 0,
				ad_user_count: 0,
				ad_computer_count: 0,
				top_domains: null,
				error: "Unable to load Active Directory data"
			},
			pentest: {
				host_count: 0,
				service_count: 0,
				password_count: 0,
				dns_count: 0,
				top_services_by_port: [],
				top_services_by_name: [],
			}
		};
	}
}

const SeverityDistributionCard = ({
	controls,
	definitionSeverityData,
}: {
	controls: any;
	definitionSeverityData: any;
}) => {
	const severities = ['critical', 'high', 'medium', 'low', 'info', 'unknown'];

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

	return (
		<div className="w-full mt-2">
			<div className="h-fit grid grid-flow-col grid-rows-2 grid-cols-3 gap-2">
				{severities.map((severity) => {
					const definitionCount = definitionSeverityData[severity] || 0;
					const style = getSeverityStyle(severity);

					return (
						<div key={severity} className="flex items-center justify-between">
							<div className="flex items-center gap-2 min-w-0">
								<span className="text-sm font-medium capitalize">
									{severity}
								</span>
							</div>
							<div className="flex items-center gap-3">
								<Badge
									variant="outline"
									className={cn("text-xs px-1 min-w-[2rem]",
										`${style.bg} ${style.text} ${style.border}`
									)}
								>
									{definitionCount}
								</Badge>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

function getIconComponent(iconName: string) {
	switch (iconName) {
		case 'upload': return Upload;
		case 'scan': return Radar;
		case 'list': return List;
		case 'shield': return Shield;
		case 'schema': return TableProperties;
		default: return Activity;
	}
}

function HomepageContent({ data }: { data: HomepageData }) {
	const totalObservations = data.execsum.total_observations_occurrences;
	const totalControls = data.execsum.total_control_occurrences;
	const securityScore = totalControls > 0 ? Math.max(0, ((totalControls - totalObservations) / totalControls) * 100) : 100;

	// Calculate risk level based on critical and high severity observations
	const highRiskCount = (data.execsum.observations_occurrences_by_severity.critical || 0) +
		(data.execsum.observations_occurrences_by_severity.high || 0);
	const riskLevel = highRiskCount > 10 ? 'High' : highRiskCount > 5 ? 'Medium' : 'Low';
	const riskColor = riskLevel === 'High' ? 'text-red-600' : riskLevel === 'Medium' ? 'text-yellow-600' : 'text-green-600';

	// Calculate success rate and n/a rate
	var successCount = 0;
	var naCount = 0;
	if (data.execsum.controls) {
		data.execsum.controls.forEach((control: any) => {
			control.occurrences.forEach((occ: any) => {
				const controlStatus = occ.status || 'unknown';
				if (controlStatus === 'ok') {
					successCount++;
				} else if (controlStatus === 'not_applicable') {
					naCount++;
				}
			});
		});
	} else {
		successCount = 0;
		naCount = 0;
	}

	const successRate = totalControls > 0 ? ((successCount / totalControls) * 100).toFixed(1) : 0;
	const naRate = totalControls > 0 ? ((naCount / totalControls) * 100).toFixed(1) : 0;

	return (
		<div className="space-y-8 pb-16">
			{/* Header */}
			<div className="space-y-2">
				<h1 className="mb-0 h-fit leading-normal text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
					Welcome to CybSuite
				</h1>
				<p className="text-xl text-muted-foreground">
					Professional cybersecurity testing and review platform
				</p>
			</div>

			{/* Executive Summary */}
			<section className="space-y-4">
				<div className="flex items-center space-x-2">
					<Shield className="h-5 w-5 text-blue-600" />
					<h2 className="text-2xl font-semibold">Executive Summary</h2>
				</div>

				{data.execsum.error ? (
					<Card className="border-l-4 border-l-red-500">
						<CardContent className="pt-6">
							<div className="flex items-center space-x-2 text-red-600">
								<AlertCircle className="h-5 w-5" />
								<p className="font-medium">Error loading executive summary</p>
							</div>
							<p className="text-sm text-muted-foreground mt-2">{data.execsum.error}</p>
						</CardContent>
					</Card>
				) : (
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
									{data.execsum.total_observations_definitions} observations with {highRiskCount} occurrences
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Controls</CardTitle>
								<Shield className="h-4 w-4 text-green-600" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{data.execsum.total_control_definitions}</div>
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
								<div className="text-2xl font-bold text-red-600">{data.execsum.total_observations_definitions}</div>
								<p className="text-xs text-muted-foreground mt-1">
									{data.execsum.total_observations_occurrences} total occurrences
								</p>
								<SeverityDistributionCard
									controls={data.execsum.controls}
									definitionSeverityData={data.execsum.observations_definitions_by_severity}
								/>
							</CardContent>
						</Card>
					</div>
				)}
			</section>

			<div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-8">
				{/* Active Directory Info */}
				<section className="flex flex-col space-y-4">
					<div className="flex items-center space-x-2">
						<FolderDot className="h-5 w-5 text-blue-600" />
						<h2 className="text-2xl font-semibold">Active Directory</h2>
					</div>

					<Card className="flex-1">
						<CardContent className="pt-6">
							{data.ad.error ? (
								<div className="flex items-center space-x-2 text-red-600">
									<AlertCircle className="h-5 w-5" />
									<div>
										<p className="font-medium">Error loading Active Directory data</p>
										<p className="text-sm text-muted-foreground mt-1">{data.ad.error}</p>
									</div>
								</div>
							) : (
								<>
									<div className="grid grid-cols-3 gap-4">
										<div className="text-center">
											<p className="text-2xl font-bold text-blue-600">{data.ad.domain_count}</p>
											<p className="text-sm text-muted-foreground">Domains</p>
										</div>
										<div className="text-center">
											<p className="text-2xl font-bold text-green-600">{data.ad.ad_user_count}</p>
											<p className="text-sm text-muted-foreground">Users</p>
										</div>
										<div className="text-center">
											<p className="text-2xl font-bold text-purple-600">{data.ad.ad_computer_count}</p>
											<p className="text-sm text-muted-foreground">Computers</p>
										</div>
									</div>

									{data.ad.top_domains && (
										<div className="mt-4 pt-4 border-t">
											<p className="text-sm text-muted-foreground">Primary Domains:</p>
											{data.ad.top_domains.map((domain, i) => (
												<div key={`domain-${i}`} className="grid grid-cols-3 gap-4 space-y-2">
													<div className="flex gap-1">
														<p className="font-medium">{domain.name}</p>
														<Link href={`/data/ad_domain/${domain.pretty_id}`}>
															<Badge variant="outline">
																<ExternalLink className="h-4 w-4" />
															</Badge>
														</Link>
													</div>
													<Badge variant="outline" className="h-fit">{domain.users_count} users</Badge>
													<Badge variant="outline" className="h-fit">{domain.computers_count} computers</Badge>
												</div>
											))}
										</div>
									)}
								</>
							)}
						</CardContent>
					</Card>
				</section>

				{/* Pentest Data */}
				<section className="flex flex-col space-y-4">
					<div className="flex items-center space-x-2">
						<Server className="h-5 w-5 text-blue-600" />
						<h2 className="text-2xl font-semibold">Penetration Testing</h2>
					</div>

					<Card className="flex-1">
						<CardContent className="pt-6">
							{data.pentest.error ? (
								<div className="flex items-center space-x-2 text-red-600">
									<AlertCircle className="h-5 w-5" />
									<div>
										<p className="font-medium">Error loading penetration testing data</p>
										<p className="text-sm text-muted-foreground mt-1">{data.pentest.error}</p>
									</div>
								</div>
							) : (
								<>
									<div className="grid grid-cols-4 gap-4 mb-4">
										<div className="text-center">
											<p className="text-2xl font-bold text-red-600">{data.pentest.host_count}</p>
											<p className="text-sm text-muted-foreground">Hosts</p>
										</div>
										<div className="text-center">
											<p className="text-2xl font-bold text-orange-600">{data.pentest.service_count}</p>
											<p className="text-sm text-muted-foreground">Services</p>
										</div>
										<div className="text-center">
											<p className="text-2xl font-bold text-yellow-700">{data.pentest.password_count}</p>
											<p className="text-sm text-muted-foreground">Passwords</p>
										</div>
										<div className="text-center">
											<p className="text-2xl font-bold text-yellow-500">{data.pentest.dns_count}</p>
											<p className="text-sm text-muted-foreground">DNS</p>
										</div>
									</div>

									{data.pentest.top_services_by_port.length > 0 && (
										<div className="pt-4 border-t">
											<div className="grid grid-cols-2 gap-8">
												<div>
													<p className="text-sm text-muted-foreground mb-2">Top Ports:</p>
													<div className="space-y-1">
														{data.pentest.top_services_by_port.map((service, index) => (
															<div key={`port-${index}`} className="flex justify-between items-center text-sm">
																<p className="font-medium">{service.service}</p>
																<Badge variant="outline" className="h-fit">{service.count}</Badge>
															</div>
														))}
													</div>
												</div>
												<div>
													<p className="text-sm text-muted-foreground mb-2">Top Services:</p>
													<div className="space-y-1">
														{data.pentest.top_services_by_name.map((service, index) => (
															<div key={`name-${index}`} className="flex justify-between items-center text-sm">
																<p className={`font-medium ${service.service === "None" ? "text-muted-foreground" : ""}`}>{service.service}</p>
																<Badge variant="outline" className="h-fit">{service.count}</Badge>
															</div>
														))}
													</div>
												</div>
											</div>
										</div>
									)}
								</>
							)}
						</CardContent>
					</Card>
				</section>
			</div>

			{/* Quick Actions */}
			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<TrendingUp className="h-5 w-5 text-blue-600" />
						<h2 className="text-2xl font-semibold">Actions</h2>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{[
						{
							key: "ingest",
							title: "Data Ingestion",
							description: "Import data from various sources",
							url: "/features/ingestors",
							icon: "upload"
						},
						{
							key: "scan",
							title: "Security Scanning",
							description: "Run automated security scans",
							url: "/features/scanners",
							icon: "scan"
						},
						{
							key: "wordlist",
							title: "Wordlist Generator",
							description: "Generate custom wordlists",
							url: "/features/wordlist_generator",
							icon: "list"
						},
					].map((shortcut) => {
						const IconComponent = getIconComponent(shortcut.icon);
						return (
							<Card key={shortcut.key} className="group hover:shadow-lg transition-all duration-200 hover:scale-105">
								<CardContent className="pt-6">
									<div className="flex items-start space-x-3">
										<div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
											<IconComponent className="h-5 w-5 text-blue-600" />
										</div>
										<div className="flex-1 min-w-0">
											<h3 className="font-semibold mb-1">{shortcut.title}</h3>
											<p className="text-sm text-muted-foreground mb-3">{shortcut.description}</p>
											<Button asChild size="sm" className="w-full">
												<Link href={shortcut.url}>
													Get Started
												</Link>
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			</section>

			{/* Quick Links */}
			<section className="space-y-4">
				<div className="flex items-center space-x-2">
					<Search className="h-5 w-5 text-blue-600" />
					<h2 className="text-2xl font-semibold">Findings</h2>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Card>
						<div className="p-4 flex justify-center items-center gap-4">
							<div className="flex-1 space-y-1">
								<h3 className="font-semibold">All Controls</h3>
								<p className="text-sm text-muted-foreground">View security control implementations</p>
							</div>
							<Link href="/controls/controls">
								<Button>Explore</Button>
							</Link>
						</div>
					</Card>

					<Card>
						<div className="p-4 flex justify-center items-center gap-4">
							<div className="flex-1 space-y-1">
								<h3 className="font-semibold">Observations</h3>
								<p className="text-sm text-muted-foreground">Review security findings and issues</p>
							</div>
							<Link href="/controls/observations">
								<Button>Explore</Button>
							</Link>
						</div>
					</Card>

					<Card>
						<div className="p-4 flex justify-center items-center gap-4">
							<div className="flex-1 space-y-1">
								<h3 className="font-semibold">Reports</h3>
								<p className="text-sm text-muted-foreground">Review comprehensive security reports and documentation</p>
							</div>
							<div>
								<Link href="/controls/report">
									<Button>
										Explore
									</Button>
								</Link>
							</div>
						</div>
					</Card>
				</div>
			</section>
		</div>
	);
}

function HomepageLoading() {
	return (
		<div className="space-y-8">
			<div className="space-y-2">
				<Skeleton className="h-10 w-96" />
				<Skeleton className="h-6 w-64" />
			</div>

			<div className="space-y-4">
				<Skeleton className="h-6 w-48" />
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Card key={i}>
							<CardContent className="pt-6">
								<Skeleton className="h-16 w-full" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{Array.from({ length: 2 }).map((_, i) => (
					<div key={i} className="space-y-4">
						<Skeleton className="h-6 w-32" />
						<Card>
							<CardContent className="pt-6">
								<Skeleton className="h-32 w-full" />
							</CardContent>
						</Card>
					</div>
				))}
			</div>
		</div>
	);
}

export default async function HomePage() {
	const data = await getHomepageData();

	return (
		<Suspense fallback={<HomepageLoading />}>
			<HomepageContent data={data} />
		</Suspense>
	);
}
