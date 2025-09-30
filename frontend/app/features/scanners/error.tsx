"use client";

import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function Error({ error }: { error: Error }) {
    return (
        <div className="container mx-auto p-6">
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Error loading scanners page: {error.message}
                </AlertDescription>
            </Alert>
        </div>
    )
}
