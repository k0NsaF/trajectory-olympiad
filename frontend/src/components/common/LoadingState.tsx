
interface LoadingStateProps {
  message?: string
}

export function LoadingState({
  message = 'Загружаем данные...'
}: LoadingStateProps) {
  return (
    <div
      className="loading-state"
      role="status"
      aria-live="polite"
    >
      <span className="loading-spinner" />
      <span>{message}</span>
    </div>
  )
}
