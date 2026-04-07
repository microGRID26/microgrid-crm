'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-400 mb-4">{error.message}</p>
        <button onClick={reset} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-md">
          Try Again
        </button>
      </div>
    </div>
  )
}
