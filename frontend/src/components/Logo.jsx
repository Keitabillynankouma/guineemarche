import { Link } from 'react-router-dom'

/**
 * Logo Guimatrix — style minimaliste sombre B
 * Usage: <Logo /> ou <Logo back /> pour version avec flèche retour
 */
export default function Logo({ back = false, className = '' }) {
  return (
    <Link to="/" className={`flex items-center gap-2 group ${className}`}>
      {back && <span className="text-gray-400 group-hover:text-gray-600 transition mr-0.5">←</span>}
      <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-sm leading-none">G</span>
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-bold text-gray-900 dark:text-white text-base tracking-tight">
          ui<span className="text-green-500">matrix</span>
        </span>
        <span className="block h-0.5 w-full bg-green-500 rounded-full mt-0.5" />
      </div>
    </Link>
  )
}
