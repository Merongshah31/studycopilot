import React from 'react'
import Card from '../components/Card'

const sections = [
  {
    title: '1. Add tasks clearly',
    points: [
      'Use specific titles: "Revise chapter 5" is better than "Study".',
      'Set deadline and priority to improve planner accuracy.',
      'Keep one task focused on one outcome.',
    ],
  },
  {
    title: '2. Use Nexa with intent',
    points: [
      'Ask with action + target: "Set priority for task Physics lab report to high".',
      'For planning: "Plan my study session for today from 8pm to 10pm".',
      'For breakdown: "Pecahkan tugasan Ulang kaji Bab 5 kepada 5 langkah".',
    ],
  },
  {
    title: '3. Review weekly schedule',
    points: [
      'Open Weekly Schedule to see Monday-Sunday task layout.',
      'Drag/review tasks and rebalance around deadlines.',
      'Use priority labels to focus on high-impact tasks first.',
    ],
  },
  {
    title: '4. Calendar and import',
    points: [
      'Connect Google Calendar before asking Nexa to create events.',
      'Use Schedule Import for class timetable PDFs.',
      'Always confirm extracted items before import.',
    ],
  },
  {
    title: '5. Keep momentum',
    points: [
      'Update task status immediately after completion.',
      'Check Analytics weekly to track progress trends.',
      'Adjust task scope early when workload becomes heavy.',
    ],
  },
  {
    title: '6. Install on phone (PWA)',
    points: [
      'Open StudyPilot in Chrome (Android) or Safari (iPhone).',
      'Android: tap browser menu (three dots) and choose "Add to Home screen" or "Install app".',
      'iPhone: tap Share button, then choose "Add to Home Screen".',
      'After install, open StudyPilot from your home screen like a normal app.',
      'If install option does not appear, refresh the page and make sure you are on the production HTTPS URL.',
    ],
  },
]

export default function Guidelines() {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-xl font-semibold">User Guidelines</h2>
        <p className="text-sm text-gray-500 mt-1">Best practices to get the most value from StudyPilot.</p>
      </Card>

      <div className="grid gap-3">
        {sections.map((section) => (
          <Card key={section.title} className="p-4 rounded-xl">
            <h3 className="font-semibold">{section.title}</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc pl-5">
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
