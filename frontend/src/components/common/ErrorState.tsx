
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({
  message,
  onRetry
}: ErrorStateProps) {
  return (
    <div
      className="error-state"
      role="alert"
    >
      <div className="error-state-icon">
        <AlertCircle size={22} />
      </div>

      <strong>Не удалось загрузить данные</strong>
      <p>{message}</p>

      {onRetry && (
        <button
          type="button"
          className="secondary-button"
          onClick={onRetry}
        >
          <RefreshCw size={15} />
          Повторить
        </button>
      )}
    </div>
  )
}
