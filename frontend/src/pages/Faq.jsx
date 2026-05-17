import React from 'react'
import Card from '../components/Card'

const FAQS = [
  {
    q: 'How do I start using StudyPilot?',
    a: 'Create an account or continue with Google/Guest. Then open Tasks and add your first assignment with a deadline and priority.',
  },
  {
    q: 'How do I use Nexa Assistant effectively?',
    a: 'Give specific prompts with task titles and dates. Example: "Break down task Revise chapter 5 into 5 steps" or "Tambah tugas Ulang kaji Bab 5 pada 2026-05-20 keutamaan tinggi."',
  },
  {
    q: 'Can I edit tasks after creating them?',
    a: 'Yes. In Tasks page, click Edit on any task, update title/deadline/priority, then click Save.',
  },
  {
    q: 'Why does Google Calendar say not connected?',
    a: 'You need to connect your Google account in Calendar page first. After connected, Nexa can create calendar events.',
  },
  {
    q: 'What is Schedule Import?',
    a: 'Upload your class schedule PDF, preview extracted items, then confirm to add them into your tasks/planner flow.',
  },
  {
    q: 'What if login fails?',
    a: 'Use Continue as Guest to access dashboard immediately, then fix SSO settings later from deployment/auth configuration.',
  },
]

export default function Faq() {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-xl font-semibold">FAQ</h2>
        <p className="text-sm text-gray-500 mt-1">Quick answers to common StudyPilot questions.</p>
      </Card>

      <div className="space-y-3">
        {FAQS.map((item) => (
          <Card key={item.q} className="p-4 rounded-xl">
            <h3 className="font-semibold">{item.q}</h3>
            <p className="text-sm text-gray-600 mt-1">{item.a}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
