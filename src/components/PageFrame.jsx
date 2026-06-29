export function PageFrame({ eyebrow, title, intro, children }) {
  return (
    <section className="pageFrame">
      <div className="pageHeader">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      {children}
    </section>
  );
}
