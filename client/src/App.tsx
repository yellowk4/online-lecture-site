import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
      <h1 className="text-3xl font-bold text-blue-500">Get started</h1>
      <p className="text-gray-600">Tailwind 적용 확인용 데모</p>
      <button
        type="button"
        className="rounded bg-blue-500 px-4 py-2 text-white transition hover:bg-blue-600"
        onClick={() => setCount((c) => c + 1)}
      >
        Count is {count}
      </button>
    </main>
  )
}

export default App
