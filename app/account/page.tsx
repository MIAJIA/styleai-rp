'use client'

import { useState } from 'react';
import Link from 'next/link';

// Define a type for the structure of a resource pack for better type safety
type ResourcePack = {
  resource_pack_name: string;
  total_quantity: number;
  remaining_quantity: number;
  effective_time: number;
  invalid_time: number;
  status: string;
}

export default function AccountPage() {
  const [balanceInfo, setBalanceInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    setIsLoading(true);
    setError(null);
    setBalanceInfo(null);
    try {
      const response = await fetch('/api/account/balance');
      const data = await response.json();

      if (!response.ok) {
        // Use the error message from the API response if available
        throw new Error(data.error || 'An unknown error occurred.');
      }
      setBalanceInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format Unix timestamps into a readable date string
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <nav className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline">
          &larr; Back to Home
        </Link>
      </nav>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">Account Resources</h1>
        <p className="mb-6 text-gray-600">Click the button below to fetch the current list of your resource packages and their remaining balance from the last 90 days.</p>
        <button
          onClick={fetchBalance}
          disabled={isLoading}
          className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-300"
        >
          {isLoading ? 'Checking...' : 'Check Account Balance'}
        </button>
      </div>


      {error && (
        <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <p><span className="font-bold">Error:</span> {error}</p>
        </div>
      )}

      {balanceInfo && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Balance Details</h2>
          {balanceInfo.data?.resource_pack_subscribe_infos?.length > 0 ? (
            <ul className="space-y-4">
              {balanceInfo.data.resource_pack_subscribe_infos.map((pack: ResourcePack, index: number) => (
                <li key={index} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="font-bold text-lg text-gray-700">{pack.resource_pack_name}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <p><strong>Status:</strong> <span className={`px-2 py-1 rounded-full text-xs font-medium ${pack.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{pack.status}</span></p>
                    <p><strong>Total:</strong> {pack.total_quantity}</p>
                    <p><strong>Remaining:</strong> <span className="font-bold text-indigo-600">{pack.remaining_quantity}</span></p>
                    <p></p> {/* Empty cell for alignment */}
                    <p className="col-span-2"><strong>Effective:</strong> {formatDate(pack.effective_time)}</p>
                    <p className="col-span-2"><strong>Expires:</strong> {formatDate(pack.invalid_time)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-gray-500">No active resource packages found in your account for the last 90 days.</p>
          )}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-700">Raw API Response:</h3>
            <pre className="mt-2 p-4 bg-gray-800 text-white text-xs rounded-md overflow-auto">
              {JSON.stringify(balanceInfo, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}