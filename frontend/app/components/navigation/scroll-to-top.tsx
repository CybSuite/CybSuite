'use client';

import { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
    const [showScrollToTop, setShowScrollToTop] = useState(false);

    // Handle scroll to show/hide scroll to top button
    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            setShowScrollToTop(scrollTop > 300); // Show button after scrolling 300px
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Handle scroll to top
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    return (
        <div className={`fixed bottom-6 right-6 z-50 transition-all duration-100 ease-in-out ${showScrollToTop
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-4 scale-75 pointer-events-none'
            }`}>
            <Button
                onClick={scrollToTop}
                className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-primary hover:bg-primary/90 cursor-pointer hover:scale-110"
                size="icon"
            >
                <ArrowUp className="h-5 w-5" />
            </Button>
        </div>
    );
}
