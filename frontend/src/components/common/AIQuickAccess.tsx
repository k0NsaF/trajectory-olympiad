import { MessageCircle } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

export function AIQuickAccess() {
  const location = useLocation()
  const navigate = useNavigate()

  if (location.pathname === '/ai' || location.pathname === '/auth') {
    return null
  }

  return (
    <div className="ai-quick-access">
      <div className="ai-quick-access-tooltip">
        ИИ-помощник. Чем могу помочь?
      </div>
      <button
        type="button"
        className="ai-quick-access-button"
        aria-label="Открыть ИИ-консультанта"
        onClick={() => navigate('/ai', { state: { sourcePath: location.pathname } })}
      >
        <MessageCircle size={23} />
      </button>
    </div>
  )
}
