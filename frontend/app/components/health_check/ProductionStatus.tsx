'use client';

import { useState, useEffect } from 'react';

interface SystemStatus {
  isOnline: boolean;
  status: 'checking' | 'online' | 'offline' | 'error';
  lastChecked?: Date;
  responseTime?: number;
}

export default function ProductionStatus() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    isOnline: false,
    status: 'checking'
  });

  const checkSystemHealth = async (): Promise<SystemStatus> => {
    const startTime = Date.now();
    
    try {
      // Use a simple endpoint that should be available in production
      // We'll try the API root endpoint first, then fallback to a simple ping
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      const response = await fetch(`${baseUrl}/health/check/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Set a reasonable timeout
        signal: AbortSignal.timeout(5000),
        // Don't send credentials in production health checks
        credentials: 'omit'
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        return {
          isOnline: true,
          status: 'online',
          lastChecked: new Date(),
          responseTime
        };
      } else {
        return {
          isOnline: false,
          status: 'error',
          lastChecked: new Date(),
          responseTime
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('System health check failed:', error);
      
      // If the primary URL failed, try localhost as fallback for local testing
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (!baseUrl.includes('localhost')) {
        try {
          const fallbackResponse = await fetch('http://localhost:8000/health/check/', {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(3000),
            credentials: 'omit'
          });
          
          if (fallbackResponse.ok) {
            return {
              isOnline: true,
              status: 'online',
              lastChecked: new Date(),
              responseTime: Date.now() - startTime
            };
          }
        } catch (fallbackError) {
          console.error('Fallback health check also failed:', fallbackError);
        }
      }
      
      return {
        isOnline: false,
        status: 'offline',
        lastChecked: new Date(),
        responseTime
      };
    }
  };

  useEffect(() => {
    // Initial health check
    checkSystemHealth().then(setSystemStatus);
    
    // Set up periodic health checks (every 30 seconds)
    const interval = setInterval(() => {
      checkSystemHealth().then(setSystemStatus);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (systemStatus.status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      case 'error':
        return 'bg-yellow-100 text-yellow-800';
      case 'checking':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = () => {
    switch (systemStatus.status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-red-500';
      case 'error':
        return 'bg-yellow-500';
      case 'checking':
      default:
        return 'bg-gray-500 animate-pulse';
    }
  };

  const getStatusText = () => {
    switch (systemStatus.status) {
      case 'online':
        return `Online${systemStatus.responseTime ? ` (${systemStatus.responseTime}ms)` : ''}`;
      case 'offline':
        return 'Offline - Connection Failed';
      case 'error':
        return 'Warning - Service Issues Detected';
      case 'checking':
      default:
        return 'Checking System Status...';
    }
  };

  const handleManualCheck = async () => {
    setSystemStatus(prev => ({ ...prev, status: 'checking' }));
    const newStatus = await checkSystemHealth();
    setSystemStatus(newStatus);
  };

  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Welcome to CybSuite</h2>
      <p className="text-gray-600 mb-8">
        Your cybersecurity suite is running in production mode.
      </p>
      
      <div className="space-y-4">
        <div className={`inline-flex items-center px-4 py-2 rounded-lg ${getStatusColor()}`}>
          <span className={`w-2 h-2 rounded-full mr-2 ${getStatusIcon()}`}></span>
          System Status: {getStatusText()}
        </div>
        
        {systemStatus.lastChecked && (
          <p className="text-sm text-gray-500">
            Last checked: {systemStatus.lastChecked.toLocaleTimeString()}
          </p>
        )}
        
        <button
          onClick={handleManualCheck}
          disabled={systemStatus.status === 'checking'}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {systemStatus.status === 'checking' ? 'Checking...' : 'Check Status'}
        </button>
      </div>
    </div>
  );
}
