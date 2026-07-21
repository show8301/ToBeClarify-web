export function ApiState({ loading, error, onRetry, children }) {
  if (loading) {
    return <div className="apiState" role="status">資料載入中…</div>;
  }

  if (error) {
    return (
      <div className="apiState apiStateError" role="alert">
        <strong>資料暫時無法載入</strong>
        <p>{error.message}</p>
        {onRetry ? <button className="btnSecondary" type="button" onClick={onRetry}>重新載入</button> : null}
      </div>
    );
  }

  return children;
}

