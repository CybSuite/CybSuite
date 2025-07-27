'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sidebar as SidebarData } from '../../types/Navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  sidebarData: SidebarData;
  className?: string;
}

export function Sidebar({ sidebarData, className }: SidebarProps) {
  if (!sidebarData.has_sidebar || sidebarData.items.length === 0) {
    return null;
  }

  return (
    <aside className={cn('w-64 border-r bg-gray-50/40', className)}>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start gap-2 px-2">
            {sidebarData.items.map((item) => (
              <Button
                key={item.name}
                variant={item.is_selected ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  item.is_selected && 'bg-secondary'
                )}
                asChild
              >
                <Link href={item.url}>
                  <span>{item.name}</span>
                  {item.is_selected && (
                    <Badge variant="outline" className="ml-auto">
                      Active
                    </Badge>
                  )}
                </Link>
              </Button>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
