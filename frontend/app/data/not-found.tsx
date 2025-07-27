import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Model Not Found
        </h1>
        <p className="text-muted-foreground mt-2">
          The requested model does not exist in the current schema.
        </p>
      </div>
      
      <div className="rounded-lg border bg-card p-6">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">What you can do:</h2>
          <ul className="text-left space-y-2 max-w-md mx-auto">
            <li>• Check if the model name is spelled correctly</li>
            <li>• Verify the model exists in your schema</li>
            <li>• Make sure your backend is properly configured</li>
          </ul>
          
          <div className="pt-4">
            <Button asChild>
              <Link href="/data">
                Back to Data Overview
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
