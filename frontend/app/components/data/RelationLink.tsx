"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEntityDetailUrl } from "@/lib/utils";

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

  // Handle array of relations (many-to-many)
  if (isArray && Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }

    return (
      <div className={cn("flex flex-wrap gap-1", className)}>
        {value.map((item, index) => {
          const displayText = item.repr || item.name || item.title || item.id || String(item);
          const itemId = item.id;

          if (!itemId) {
            return (
              <span 
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-gray-800 text-xs font-medium"
              >
                {displayText}
              </span>
            );
          }

          return (
            <Link
              key={index}
              href={getEntityDetailUrl(entityName, itemId)}
              className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-800 text-xs font-medium hover:bg-blue-100 transition-colors group"
            >
              <span className="truncate max-w-[120px]" title={displayText}>
                {displayText}
              </span>
              <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          );
        })}
      </div>
    );
  }

  // Handle single relation (one-to-many, foreign key)
  const displayText = value.repr || value.name || value.title || value.id || String(value);
  const itemId = value.id;

  if (!itemId) {
    return (
      <span className={cn("inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-gray-800 text-xs font-medium", className)}>
        {displayText}
      </span>
    );
  }

  return (
    <Link
      href={getEntityDetailUrl(entityName, itemId)}
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-800 text-xs font-medium hover:bg-blue-100 transition-colors group",
        className
      )}
    >
      <span className="truncate max-w-[120px]" title={displayText}>
        {displayText}
      </span>
      <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
