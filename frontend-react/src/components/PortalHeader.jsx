import { Landmark } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PortalHeader({children, hi = false}) {
  return <header className="portal-header">
    <Link to="/" className="portal-brand" aria-label="SmartResolve home">
      <span className="portal-mark"><Landmark size={23} strokeWidth={1.8} aria-hidden="true"/></span>
      SmartResolve
    </Link>
    <nav aria-label={hi ? 'मुख्य नेविगेशन' : 'Main navigation'}>{children}</nav>
  </header>
}
