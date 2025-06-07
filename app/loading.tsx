export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-16 h-16 relative mx-auto mb-4">
          <div className="w-16 h-16 rounded-full border-4 border-neutral-100"></div>
          <div className="w-16 h-16 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0 animate-spin"></div>
        </div>
        <p className="text-neutral-600 font-medium">Loading Ensemble...</p>
      </div>
    </div>
  )
}
