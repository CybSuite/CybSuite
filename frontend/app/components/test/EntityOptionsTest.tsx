"use client";

import * as React from "react";
import { api } from "@/app/lib/api";

// Simple component to test the entity options API
export function EntityOptionsTest() {
  const [options, setOptions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rawResponse, setRawResponse] = React.useState<any>(null);

  const testEntityOptions = async (entityName: string) => {
    setLoading(true);
    setError(null);
    setRawResponse(null);
    try {
      console.log(`Testing API call for entity: ${entityName}`);
      const response = await api.data.getEntityOptions(entityName);
      console.log(`Full response:`, response);
      
      setRawResponse(response);
      
      if (response.error) {
        setError(response.error);
      } else {
        setOptions(response.data || []);
      }
    } catch (err) {
      console.error('Exception in test:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Test with control_definition first
    testEntityOptions('control_definition');
  }, []);

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Entity Options API Test</h3>
      
      <div className="space-y-2">
        <button 
          onClick={() => testEntityOptions('control_definition')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={loading}
        >
          Test control_definition options
        </button>

        <button 
          onClick={() => testEntityOptions('compliance')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 ml-2"
          disabled={loading}
        >
          Test compliance options
        </button>
      </div>

      {loading && <p className="mt-4 text-blue-600">Loading...</p>}
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded">
          <p className="text-red-700">Error: {error}</p>
        </div>
      )}

      {rawResponse && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Raw API Response:</h4>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-60">
            {JSON.stringify(rawResponse, null, 2)}
          </pre>
        </div>
      )}

      {options.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Parsed Options ({options.length}):</h4>
          <div className="max-h-60 overflow-auto border border-gray-200 rounded p-3">
            {options.slice(0, 10).map((option, index) => (
              <div key={index} className="flex justify-between py-1 border-b border-gray-100">
                <span className="font-mono text-sm">ID: {option.id}</span>
                <span className="text-sm">{option.repr}</span>
              </div>
            ))}
            {options.length > 10 && (
              <p className="text-gray-500 text-sm mt-2">... and {options.length - 10} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
