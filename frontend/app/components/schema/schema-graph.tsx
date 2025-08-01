'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import {
    ReactFlow,
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    NodeTypes,
    Handle,
    Position,
    BackgroundVariant,
    NodeChange,
    applyNodeChanges
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EntitySchema, FieldSchema } from '../../types/Data';
import { Badge } from '@/components/ui/badge';
import { Link2, Key, Hash } from 'lucide-react';

interface SchemaGraphProps {
    entities: EntitySchema[];
}

// Custom Entity Node Component
const EntityNode = ({ data }: { data: any }) => {
    const { entity, referencedFields } = data;

    return (
        <div className="bg-card border rounded-lg shadow-lg min-w-[250px]">
            {/* Entity Header - This acts as the drag handle */}
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-t-lg cursor-move">
                <h3 className="font-semibold text-sm pointer-events-none">{entity.name}</h3>
                {entity.category && (
                    <Badge variant="secondary" className="text-xs mt-1 pointer-events-none">
                        {entity.category}
                    </Badge>
                )}
            </div>

            {/* Referenced Fields */}
            <div className="p-3 space-y-2 pointer-events-none">
                {referencedFields.length > 0 ? (
                    <>
                        <div className="text-xs text-muted-foreground font-medium mb-2">
                            Relationship Fields:
                        </div>
                        {referencedFields.map((field: FieldSchema, index: number) => (
                            <div
                                key={field.name}
                                className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs relative"
                            >
                                <div className="flex items-center space-x-2">
                                    {field.unique && <Key className="h-3 w-3 text-yellow-500" />}
                                    {field.indexed && <Hash className="h-3 w-3 text-green-500" />}
                                    <Link2 className="h-3 w-3 text-blue-500" />
                                    <span className="font-medium">{field.name}</span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    {field.referenced_entity}
                                </Badge>

                                {/* Handle for outgoing connections */}
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={`${entity.name}-${field.name}`}
                                    className="pointer-events-auto"
                                    style={{
                                        right: -8,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: 8,
                                        height: 8,
                                        background: '#3b82f6',
                                        border: '2px solid white'
                                    }}
                                />
                            </div>
                        ))}
                    </>
                ) : (
                    <div className="text-xs text-muted-foreground py-2">
                        No relationship fields
                    </div>
                )}
            </div>

            {/* Handle for incoming connections */}
            <Handle
                type="target"
                position={Position.Left}
                className="pointer-events-auto"
                style={{
                    left: -8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 8,
                    height: 8,
                    background: '#10b981',
                    border: '2px solid white'
                }}
            />
        </div>
    );
};

const nodeTypes: NodeTypes = {
    entityNode: EntityNode,
};

export function SchemaGraph({ entities }: SchemaGraphProps) {
    // Initialize nodes and edges
    const initialData = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // Create a map for quick entity lookup
        const entityMap = new Map(entities.map(entity => [entity.name, entity]));

        // Separate entities into connected and isolated
        const connectedEntities: EntitySchema[] = [];
        const isolatedEntities: EntitySchema[] = [];

        entities.forEach((entity) => {
            // Get ALL referenced fields (not just ones pointing to visible entities)
            const allReferencedFields = Object.values(entity.fields).filter(
                field => field.referenced_entity
            );

            // Get referenced fields that point to visible entities (for edge creation)
            const visibleReferencedFields = Object.values(entity.fields).filter(
                field => field.referenced_entity && entityMap.has(field.referenced_entity)
            );

            // Check if this entity is referenced by any other entity
            const isReferencedByOthers = entities.some(otherEntity =>
                Object.values(otherEntity.fields).some(field =>
                    field.referenced_entity === entity.name
                )
            );

            // Entity is connected if it has outgoing references OR is referenced by others
            if (allReferencedFields.length > 0 || isReferencedByOthers) {
                connectedEntities.push(entity);
            } else {
                isolatedEntities.push(entity);
            }
        });

        // Position calculation helpers - increased spacing
        const GRID_SIZE = 600; // Increased from 400
        const COLS = Math.ceil(Math.sqrt(connectedEntities.length));

        // Position connected entities in the main area
        connectedEntities.forEach((entity, index) => {
            // Get ALL referenced fields to show in the node
            const allReferencedFields = Object.values(entity.fields).filter(
                field => field.referenced_entity
            );

            // Get referenced fields that point to visible entities (for edge creation)
            const visibleReferencedFields = Object.values(entity.fields).filter(
                field => field.referenced_entity && entityMap.has(field.referenced_entity)
            );

            // Calculate position in a grid layout
            const col = index % COLS;
            const row = Math.floor(index / COLS);
            const x = col * GRID_SIZE;
            const y = row * GRID_SIZE;

            // Create node with ALL referenced fields (even if target entities aren't visible)
            nodes.push({
                id: entity.name,
                type: 'entityNode',
                position: { x, y },
                draggable: true,
                data: {
                    entity,
                    referencedFields: allReferencedFields // Show all relationship fields
                },
            });

            // Create edges ONLY for referenced fields where target entity is visible
            visibleReferencedFields.forEach((field) => {
                if (field.referenced_entity && entityMap.has(field.referenced_entity)) {
                    edges.push({
                        id: `${entity.name}-${field.name}-${field.referenced_entity}`,
                        source: entity.name,
                        target: field.referenced_entity,
                        sourceHandle: `${entity.name}-${field.name}`,
                        type: 'smoothstep',
                        animated: true,
                        style: {
                            stroke: '#3b82f6',
                            strokeWidth: 2,
                        },
                        label: field.name,
                        labelStyle: {
                            fontSize: '10px',
                            fontWeight: 500,
                            fill: '#6b7280',
                        },
                        labelBgStyle: {
                            fill: 'white',
                            fillOpacity: 0.9,
                        },
                    });
                }
            });
        });

        // Position isolated entities in the top-right area
        const isolatedCols = Math.ceil(Math.sqrt(isolatedEntities.length));
        const isolatedStartX = (COLS * GRID_SIZE) + 200; // Start after connected entities with some padding
        const isolatedStartY = 50; // Start near the top

        isolatedEntities.forEach((entity, index) => {
            // Get ALL referenced fields to show in the node (even for isolated entities)
            const allReferencedFields = Object.values(entity.fields).filter(
                field => field.referenced_entity
            );

            const col = index % isolatedCols;
            const row = Math.floor(index / isolatedCols);
            const x = isolatedStartX + (col * 300); // Smaller spacing for isolated entities
            const y = isolatedStartY + (row * 200);

            // Create node (isolated entities might have referenced fields, just no connections to visible entities)
            nodes.push({
                id: entity.name,
                type: 'entityNode',
                position: { x, y },
                draggable: true,
                data: {
                    entity,
                    referencedFields: allReferencedFields // Show all relationship fields
                },
            });
        });

        return { nodes, edges };
    }, [entities]);

    // State for nodes (to handle position changes)
    const [nodes, setNodes] = useState<Node[]>(initialData.nodes);
    const edges = initialData.edges;

    // Update nodes when entities change
    useEffect(() => {
        setNodes(initialData.nodes);
    }, [initialData.nodes]);

    // Handle node changes (including position updates)
    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );

    return (
        <div className="w-full h-[600px] border rounded-lg bg-background">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                nodeTypes={nodeTypes}
                nodesDraggable={true}
                nodesConnectable={false}
                elementsSelectable={true}
                fitView
                fitViewOptions={{
                    padding: 0.2,
                    includeHiddenNodes: false,
                }}
                minZoom={0.1}
                maxZoom={2}
                attributionPosition="top-right"
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                <Controls position="top-left" />
                <MiniMap
                    position="bottom-right"
                    nodeStrokeWidth={3}
                    nodeColor={(node) => {
                        const referencedFields = node.data?.referencedFields || [];
                        return Array.isArray(referencedFields) && referencedFields.length > 0 ? '#3b82f6' : '#6b7280';
                    }}
                    maskColor="rgb(240, 240, 240, 0.6)"
                />
            </ReactFlow>
        </div>
    );
}
