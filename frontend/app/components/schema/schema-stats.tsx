import { EntitySchema } from '../../types/Data';
import { Database, Grid3x2, Link2 } from 'lucide-react';

interface SchemaStatsProps {
    entities: EntitySchema[];
    filteredEntities: EntitySchema[];
    hasActiveFilters: boolean;
}

export function SchemaStats({ entities, filteredEntities, hasActiveFilters }: SchemaStatsProps) {
    const totalFields = entities.reduce((acc, entity) => acc + Object.keys(entity.fields).length, 0);
    const filteredFields = filteredEntities.reduce((acc, entity) => acc + Object.keys(entity.fields).length, 0);

    const totalRelations = entities.reduce((acc, entity) =>
        acc + Object.values(entity.fields).filter(field => field.referenced_entity).length, 0
    );
    const filteredRelations = filteredEntities.reduce((acc, entity) =>
        acc + Object.values(entity.fields).filter(field => field.referenced_entity).length, 0
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg border bg-card p-6">
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <h3 className="text-sm font-medium">Total Entities</h3>
                    <Database className="h-4 w-4 text-muted-foreground" />
                </div>
                {hasActiveFilters ? (
                    <div className="text-2xl font-bold">{filteredEntities.length}/{entities.length}</div>
                ) : (
                    <div className="text-2xl font-bold">{entities.length}</div>
                )}
            </div>

            <div className="rounded-lg border bg-card p-6">
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <h3 className="text-sm font-medium">Total Fields</h3>
                    <Grid3x2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">
                    {hasActiveFilters ? (
                        <>{filteredFields}/{totalFields}</>
                    ) : (
                        <>{totalFields}</>
                    )}
                </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <h3 className="text-sm font-medium">Relations</h3>
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">
                    {hasActiveFilters ? (
                        <>{filteredRelations}/{totalRelations}</>
                    ) : (
                        <>{totalRelations}</>
                    )}
                </div>
            </div>
        </div>
    );
}
