import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import { apiFetch } from '../lib/api'

export default function Analytics() {
  const [data, setData] = useState(null)
  useEffect(() => { apiFetch('/analytics/overview').then(setData).catch(() => {}) }, [])
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Analytics</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-sm text-gray-500">Completed Tasks</p><p className="text-2xl font-semibold">{data?.totals?.completedTasks ?? 0}</p></Card>
        <Card className="p-4"><p className="text-sm text-gray-500">Study Minutes</p><p className="text-2xl font-semibold">{data?.totals?.totalStudyMinutes ?? 0}</p></Card>
        <Card className="p-4"><p className="text-sm text-gray-500">Productivity</p><p className="text-2xl font-semibold">{data?.totals?.productivityScore ?? 0}%</p></Card>
      </div>
    </div>
  )
}

