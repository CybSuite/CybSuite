"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEntityDetailUrl } from "@/lib/utils";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface RelationLinkProps {
	value: any;
	entityName: string;
	isArray?: boolean;
	className?: string;
}

/**
 * Component for rendering relation fields as clickable links to detail pages
 */
export function RelationLink({ value, entityName, isArray = false, className }: RelationLinkProps) {
	if (!value) {
		return <span className="text-muted-foreground">—</span>;
	}

	return (
		<TooltipProvider>
			{/* Handle array of relations (many-to-many) */}
			{isArray && Array.isArray(value) ? (
				value.length === 0 ? (
					<span className="text-muted-foreground">—</span>
				) : (
					<div className={cn("flex flex-wrap gap-1", className)}>
						{value.slice(0, 3).map((item, index) => {
							const displayText = item.repr || item.name || item.title || item.id || String(item);
							const itemId = item.id;

							if (!itemId) {
								return (
									<Tooltip key={index}>
										<TooltipTrigger asChild>
											<span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-gray-800 text-xs font-medium">
												<span className="truncate max-w-[120px]">
													{displayText}
												</span>
											</span>
										</TooltipTrigger>
										<TooltipContent>
											<p>{displayText}</p>
										</TooltipContent>
									</Tooltip>
								);
							}

							return (
								<Tooltip key={index}>
									<TooltipTrigger asChild>
										<Link
											href={getEntityDetailUrl(entityName, itemId)}
											className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-800 text-xs font-medium hover:bg-blue-100 transition-colors group"
										>
											<span className="truncate max-w-[120px]">
												{displayText}
											</span>
											<ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
										</Link>
									</TooltipTrigger>
									<TooltipContent>
										<p>{displayText}</p>
									</TooltipContent>
								</Tooltip>
							);
						})}
						{value.length > 3 && (
							<span
								className="inline-flex items-center px-2 py-1 rounded-md bg-orange-50 text-orange-800 text-xs font-medium"
								title={`${value.length - 3} more item${value.length - 3 === 1 ? '' : 's'}`}
							>
								+{value.length - 3}
							</span>
						)}
					</div>
				)
			) : (
				// Handle single relation (one-to-many, foreign key)
				(() => {
					const displayText = value.repr || value.name || value.title || value.id || String(value);
					const itemId = value.id;

					if (!itemId) {
						return (
							<Tooltip>
								<TooltipTrigger asChild>
									<span className={cn("inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-gray-800 text-xs font-medium", className)}>
										<span className="truncate max-w-[120px]">
											{displayText}
										</span>
									</span>
								</TooltipTrigger>
								<TooltipContent>
									<p>{displayText}</p>
								</TooltipContent>
							</Tooltip>
						);
					}

					return (
						<Tooltip>
							<TooltipTrigger asChild>
								<Link
									href={getEntityDetailUrl(entityName, itemId)}
									className={cn(
										"inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-800 text-xs font-medium hover:bg-blue-100 transition-colors group",
										className
									)}
								>
									<span className="truncate max-w-[120px]">
										{displayText}
									</span>
									<ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
								</Link>
							</TooltipTrigger>
							<TooltipContent>
								<p>{displayText}</p>
							</TooltipContent>
						</Tooltip>
					);
				})()
			)}
		</TooltipProvider>
	);
}
