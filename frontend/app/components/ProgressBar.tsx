import { cn } from '@/lib/utils'

interface ProgressBarProps {
    /** Progress mode: 'single' for one progress bar, 'dual' for two-tier progress system */
    mode?: 'single' | 'dual'
    /** Overall progress percentage (0-100) */
    progress?: number
    /** Secondary progress percentage for dual mode (0-100) */
    secondaryProgress?: number
    /** Show indeterminate/marquee animation when progress is unknown */
    showMarquee?: boolean
    /** Show indeterminate/marquee animation for secondary progress bar in dual mode */
    showSecondaryMarquee?: boolean
    /** Label for overall progress (dual mode only) */
    overallLabel?: string
    /** Label for secondary progress (dual mode only) */
    secondaryLabel?: string
    /** Secondary progress status text (e.g., "Processing...", "5 of 10 tasks") */
    secondaryStatus?: string
    /** Custom width container class */
    containerClass?: string
    /** Show progress percentage text */
    showPercentage?: boolean
    /** Custom colors for progress bars */
    colors?: {
        overall?: string
        secondary?: string
        overallMarquee?: string
        secondaryMarquee?: string
    }
    /** Size variant */
    size?: 'sm' | 'md' | 'lg'
}

export function ProgressBar({
    mode = 'single',
    progress = 0,
    secondaryProgress = 0,
    showMarquee = false,
    showSecondaryMarquee = false,
    overallLabel = 'Overall',
    secondaryLabel = 'Current Task',
    secondaryStatus,
    containerClass = 'max-w-sm mx-auto',
    showPercentage = true,
    colors = {
        overall: 'from-blue-500 to-blue-600',
        secondary: 'from-green-500 to-green-600',
        overallMarquee: 'from-blue-400 to-blue-600',
        secondaryMarquee: 'from-green-400 to-green-600',
    },
    size = 'md',
}: ProgressBarProps) {
    const sizeClasses = {
        sm: {
            overall: 'h-1',
            secondary: 'h-1',
            text: 'text-xs',
            marqueeWidth: 'w-24',
        },
        md: {
            overall: 'h-2',
            secondary: 'h-1.5',
            text: 'text-xs',
            marqueeWidth: 'w-32',
        },
        lg: {
            overall: 'h-3',
            secondary: 'h-2',
            text: 'text-sm',
            marqueeWidth: 'w-40',
        },
    }

    const sizeConfig = sizeClasses[size]

    if (mode === 'dual') {
        return (
            <div className={cn('space-y-3', containerClass)}>
                {/* Overall Progress Bar */}
                <div className="space-y-1">
                    {showPercentage && (
                        <div className={cn('flex justify-between font-medium text-gray-700', sizeConfig.text)}>
                            <span>{overallLabel}</span>
                            <span>{progress}%</span>
                        </div>
                    )}
                    <div className={cn('relative bg-gray-200 rounded-full overflow-hidden', sizeConfig.overall)}>
                        {showMarquee ? (
                            <div
                                className={cn(
                                    'absolute top-0 left-0 h-full bg-gradient-to-r rounded-full animate-marquee',
                                    colors.overallMarquee,
                                    sizeConfig.marqueeWidth
                                )}
                            />
                        ) : (
                            <div
                                className={cn(
                                    'absolute top-0 left-0 h-full bg-gradient-to-r transition-all duration-300 ease-out rounded-full',
                                    colors.overall
                                )}
                                style={{ width: `${progress}%` }}
                            />
                        )}
                    </div>
                </div>

                {/* Secondary/Current Task Progress Bar */}
                <div className="space-y-1">
                    {showPercentage && (
                        <div className={cn('flex justify-between font-medium text-gray-700', sizeConfig.text)}>
                            <span>{secondaryLabel}</span>
                            {secondaryStatus ? (
                                <span>{secondaryStatus}</span>
                            ) : (
                                <span>{secondaryProgress}%</span>
                            )}
                        </div>
                    )}
                    <div className={cn('relative bg-gray-200 rounded-full overflow-hidden', sizeConfig.secondary)}>
                        {showSecondaryMarquee ? (
                            <div
                                className={cn(
                                    'absolute top-0 left-0 h-full bg-gradient-to-r rounded-full animate-marquee',
                                    colors.secondaryMarquee,
                                    sizeConfig.marqueeWidth
                                )}
                            />
                        ) : (
                            <div
                                className={cn(
                                    'absolute top-0 left-0 h-full bg-gradient-to-r transition-all duration-300 ease-out rounded-full',
                                    colors.secondary
                                )}
                                style={{ width: `${secondaryProgress}%` }}
                            />
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // Single progress bar mode
    return (
        <div className={cn('space-y-1', containerClass)}>
            {showPercentage && (
                <div className={cn('flex justify-between font-medium text-gray-700', sizeConfig.text)}>
                    <span>Progress</span>
                    <span>{progress}%</span>
                </div>
            )}
            <div className={cn('relative bg-gray-200 rounded-full overflow-hidden', sizeConfig.overall)}>
                {showMarquee ? (
                    <div
                        className={cn(
                            'absolute top-0 left-0 h-full bg-gradient-to-r rounded-full animate-marquee',
                            colors.overallMarquee,
                            sizeConfig.marqueeWidth
                        )}
                    />
                ) : (
                    <div
                        className={cn(
                            'absolute top-0 left-0 h-full bg-gradient-to-r transition-all duration-300 ease-out rounded-full',
                            colors.overall
                        )}
                        style={{ width: `${progress}%` }}
                    />
                )}
            </div>
        </div>
    )
}

// Convenience components for common use cases
export function SingleProgressBar(props: Omit<ProgressBarProps, 'mode'>) {
    return <ProgressBar {...props} mode="single" />
}

export function DualProgressBar(props: Omit<ProgressBarProps, 'mode'>) {
    return <ProgressBar {...props} mode="dual" />
}

// Preset configurations for common scenarios
export function LoadingProgressBar(props?: Partial<ProgressBarProps>) {
    return (
        <ProgressBar
            mode="single"
            progress={0}
            showMarquee
            showPercentage={false}
            containerClass="max-w-xs mx-auto"
            {...props}
        />
    )
}

export function ScanProgressBar({
    overallProgress,
    taskProgress,
    totalSteps,
    ...props
}: Partial<ProgressBarProps> & {
    overallProgress?: number
    taskProgress?: number
    totalSteps?: number
}) {
    const showSecondaryMarquee = !totalSteps || totalSteps <= 0
    const secondaryStatus = totalSteps && totalSteps > 0
        ? `${taskProgress || 0}%`
        : 'Processing...'

    return (
        <ProgressBar
            mode="dual"
            progress={overallProgress || 0}
            secondaryProgress={taskProgress || 0}
            showSecondaryMarquee={showSecondaryMarquee}
            secondaryStatus={secondaryStatus}
            overallLabel="Overall"
            secondaryLabel="Current Task"
            {...props}
        />
    )
}
