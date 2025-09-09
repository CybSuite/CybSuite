'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
	return (
		<div className="min-h-[75vh] flex items-center justify-center p-4">
			<div className="max-w-md w-full">
				<Card className="text-center">
					<CardHeader className="pb-6">
						<div className="flex justify-center mb-4">
							<AlertCircle className="h-16 w-16 text-destructive" />
						</div>

						<CardTitle className="text-2xl font-bold">404 - Page Not Found</CardTitle>
					</CardHeader>

					<CardContent className="space-y-6">
						<CardDescription className="text-base leading-relaxed">
							The page you're looking for doesn't exist. It may have been moved, deleted,
							or the URL might be incorrect.
						</CardDescription>

						<div className="flex flex-col gap-2">
							<Button asChild className="w-full">
								<Link href="/">
									<Home className="h-4 w-4 mr-2" />
									Return to Home
								</Link>
							</Button>

							<Button variant="outline" onClick={() => window.history.back()} className="w-full">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Go Back
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
