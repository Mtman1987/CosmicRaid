'use client';

import { useState } from 'react';
import { testDatabaseConnection } from '@/lib/actions';

export function DatabaseTest() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [serverId] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('discordServerId') || '' : '');
  const [userId] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('discordUserId') || '' : '');

  const handleTest = async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      setResult({ status: 'error', message: 'No session found. Please login again.' });
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    
    const testResult = await testDatabaseConnection(null, formData);
    setResult(testResult);
    setLoading(false);
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">🔍 Database Connection Test</h3>
      
      <div className="space-y-2 mb-4">
        <p className="text-sm text-muted-foreground">Server ID: {serverId || 'Not set'}</p>
        <p className="text-sm text-muted-foreground">User ID: {userId || 'Not set'}</p>
      </div>
      
      <button
        onClick={handleTest}
        disabled={loading}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Connection'}
      </button>
      
      {result && (
        <div className={`mt-4 p-3 rounded-md ${
          result.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          <p className="font-medium">{result.message}</p>
          {result.data && (
            <pre className="mt-2 text-xs overflow-auto">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}