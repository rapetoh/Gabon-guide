import { Suspense } from 'react'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">O&apos;KILI</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Dashboard</p>
        </div>
        <Suspense fallback={<div className="bg-white rounded-2xl border border-gray-100 p-8 h-48" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
