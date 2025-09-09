'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Construction, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ComingSoonPageProps {
	title?: string;
	description?: string;
	feature?: string;
	showBackButton?: boolean;
}

const ComingSoonPage: React.FC<ComingSoonPageProps> = ({
	title = "Coming Soon",
	description = "This feature is currently under development and will be available soon.",
	feature,
	showBackButton = true
}) => {
	const router = useRouter();

	const handleGoBack = () => {
		if (window.history.length > 1) {
			router.back();
		} else {
			router.push('/');
		}
	};

	return (
		<div className="min-h-[75vh] flex items-center justify-center p-4">
			<div className="max-w-md w-full">
				<Card className="text-center">
					<CardHeader className="pb-6">
						<div className="flex justify-center mb-4">
							<div className="relative">
								<Construction className="h-16 w-16 text-muted-foreground" />
								<Clock className="h-8 w-8 text-primary absolute -bottom-2 -right-2 bg-background rounded-full p-1" />
							</div>
						</div>

						<CardTitle className="text-2xl font-bold">{title}</CardTitle>

						{feature && (
							<div className="flex justify-center mt-2">
								<Badge variant="outline" className="text-sm">
									<Wrench className="h-3 w-3 mr-1" />
									{feature}
								</Badge>
							</div>
						)}
					</CardHeader>

					<CardContent className="space-y-6">
						<CardDescription className="text-base leading-relaxed">
							{description}
						</CardDescription>

						<div className="space-y-3">
							<div className="flex flex-col gap-2">
								{showBackButton && (
									<Button
										variant="outline"
										onClick={handleGoBack}
										className="w-full"
									>
										<ArrowLeft className="h-4 w-4 mr-2" />
										Go Back
									</Button>
								)}

								<Button
									variant="default"
									onClick={() => router.push('/')}
									className="w-full"
								>
									Return to Home
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default ComingSoonPage;
