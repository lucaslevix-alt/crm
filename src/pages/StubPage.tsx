interface StubPageProps {
  title: string
  description?: string
}

export function StubPage({ title, description = 'Em breve.' }: StubPageProps) {
  return (
    <div className="content">
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
      <p style={{ color: 'var(--text2)' }}>{description}</p>
    </div>
  )
}
