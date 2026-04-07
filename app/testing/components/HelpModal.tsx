'use client'

import {
  X, ClipboardCheck, ListFilter, MousePointer, Columns2,
  CheckCircle2, MessageSquare, Award, Keyboard, ArrowRight,
} from 'lucide-react'

interface HelpModalProps {
  onClose: () => void
}

const STEPS = [
  { icon: ListFilter, color: 'text-green-400', bg: 'bg-green-500/15', title: 'Find your tests', desc: 'Your assigned tests show up under "My Tests". Each plan is a group of related test cases. Click a plan to expand it.' },
  { icon: MousePointer, color: 'text-blue-400', bg: 'bg-blue-500/15', title: 'Open a test case', desc: 'Click any test case to see the instructions and expected result. If the test has a page link, it loads in a split-screen view right next to the instructions.' },
  { icon: Columns2, color: 'text-purple-400', bg: 'bg-purple-500/15', title: 'Test in split-screen', desc: 'The left side shows what to do. The right side shows the actual page. Follow the steps and check if it works correctly.' },
  { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/15', title: 'Mark your result', desc: 'Click Pass if it works. Click Fail or Blocked if something is wrong -- type what happened in the feedback box. You can paste screenshots with Cmd+V.' },
  { icon: MessageSquare, color: 'text-amber-400', bg: 'bg-amber-500/15', title: 'Feedback & comments', desc: 'Your feedback goes directly to the dev team. They can reply with comments and request re-tests when bugs are fixed.' },
  { icon: Award, color: 'text-yellow-400', bg: 'bg-yellow-500/15', title: 'Earn badges', desc: 'Complete all tests in a plan to earn an achievement badge. Badges show your progress and help the team track coverage.' },
]

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-gray-900 to-gray-800 rounded-t-2xl px-6 py-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Welcome to QA Testing</h2>
              <p className="text-white/40 text-[12px]">Here&apos;s how it works</p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-5">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={i} className="flex gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${step.bg}`}>
                  <Icon className={`w-4 h-4 ${step.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                  <p className="text-[13px] text-gray-400 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            )
          })}

          {/* Tips */}
          <div className="bg-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Keyboard className="w-4 h-4 text-gray-400" />
              <p className="text-[12px] font-semibold text-gray-300">Tips</p>
            </div>
            <ul className="text-[12px] text-gray-400 space-y-1.5">
              <li>&#8226; <strong className="text-gray-300">Cmd+V</strong> to paste a screenshot from your clipboard</li>
              <li>&#8226; Click <strong className="text-gray-300">&quot;Open&quot;</strong> to open the test page in a new tab</li>
              <li>&#8226; Click <strong className="text-gray-300">&quot;Full&quot;</strong> to toggle between split and full-width view</li>
              <li>&#8226; Tests auto-advance to the next one after you submit</li>
              <li>&#8226; Orange pulsing items are <strong className="text-gray-300">re-test requests</strong> -- test these first</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-4 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors"
          >
            Got it, let&apos;s start testing
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
