'use client'

import { useState } from 'react'
import {
  X, ChevronRight, ChevronLeft, ClipboardCheck, ListFilter,
  MousePointer, Columns2, CheckCircle2, XCircle, Ban,
  MessageSquare, Award, Camera, ArrowRight, HelpCircle, Sparkles,
} from 'lucide-react'

interface HelpModalProps {
  onClose: () => void
}

const STEPS = [
  {
    icon: ClipboardCheck,
    color: 'text-green-400',
    bg: 'bg-green-500/15',
    border: 'border-green-500/30',
    title: 'Welcome to QA Testing!',
    subtitle: "Here's what we need from you",
    body: "We're testing MicroGRID to make sure everything works perfectly before we go live. You've been assigned specific features to test based on your role.",
    visual: (
      <div className="bg-gray-900 rounded-xl p-4 mt-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>You test it</span>
          <div className="w-2 h-2 rounded-full bg-amber-500 ml-4" />
          <span>You report what happened</span>
          <div className="w-2 h-2 rounded-full bg-blue-500 ml-4" />
          <span>We fix it</span>
        </div>
        <p className="text-[11px] text-gray-500">That's it. No coding. No technical knowledge needed.</p>
      </div>
    ),
  },
  {
    icon: ListFilter,
    color: 'text-blue-400',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    title: 'Step 1: Find Your Tests',
    subtitle: 'Click "My Tests" to see only yours',
    body: 'When you land on this page, toggle to "My Tests" at the top. You\'ll see test plans — these are groups of related tests. Each plan has a progress bar showing how far along you are.',
    visual: (
      <div className="bg-gray-900 rounded-xl p-4 mt-4">
        <div className="flex gap-2 mb-3">
          <div className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-medium">My Tests</div>
          <div className="px-3 py-1.5 bg-gray-700 text-gray-400 text-xs rounded-lg">All Tests</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white font-medium">Project Management</span>
            <span className="text-xs text-gray-400">0 / 7</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full">
            <div className="h-1.5 bg-green-500 rounded-full w-0" />
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: MousePointer,
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30',
    title: 'Step 2: Open a Test',
    subtitle: 'Click any test case to start',
    body: 'Each test has step-by-step instructions telling you exactly what to do. Read them carefully — they tell you what page to go to, what buttons to click, and what to look for.',
    visual: (
      <div className="bg-gray-900 rounded-xl p-4 mt-4">
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded">Critical</span>
            <span className="text-sm text-white">Create a new project</span>
          </div>
          <div className="text-xs text-gray-400 leading-relaxed">
            <strong className="text-gray-300">Instructions:</strong> Click "+ New Project" on the Pipeline page. Fill in the name, address, phone...
          </div>
          <div className="text-xs text-green-400/80 leading-relaxed">
            <strong className="text-green-400">Expected:</strong> A new project card appears in the first pipeline stage...
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Columns2,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/15',
    border: 'border-cyan-500/30',
    title: 'Step 3: Split-Screen Mode',
    subtitle: 'Instructions on the left, the app on the right',
    body: "When you open a test, the screen splits in two. The left side shows what to do. The right side loads the actual page you're testing. Follow the steps on the left while working on the right.",
    visual: (
      <div className="bg-gray-900 rounded-xl p-4 mt-4">
        <div className="flex gap-2 h-24">
          <div className="flex-1 bg-gray-800 rounded-lg border border-gray-700 p-2">
            <div className="text-[10px] text-gray-400 mb-1">Instructions</div>
            <div className="space-y-1">
              <div className="h-1.5 bg-gray-600 rounded w-full" />
              <div className="h-1.5 bg-gray-600 rounded w-4/5" />
              <div className="h-1.5 bg-gray-600 rounded w-3/5" />
            </div>
          </div>
          <div className="flex-1 bg-gray-800 rounded-lg border border-cyan-500/30 p-2 relative">
            <div className="text-[10px] text-cyan-400 mb-1">Live App Page</div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] text-gray-500">The actual page loads here</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    title: 'Step 4: Tell Us What Happened',
    subtitle: 'Four buttons — pick the one that fits',
    body: "After following the instructions, click one of the four buttons below. If something doesn't work, click Fail or Blocked and tell us what happened — that's the most valuable feedback you can give.",
    visual: (
      <div className="bg-gray-900 rounded-xl p-4 mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <div>
              <div className="text-xs text-emerald-400 font-medium">Pass</div>
              <div className="text-[10px] text-gray-500">It works correctly</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <div>
              <div className="text-xs text-red-400 font-medium">Fail</div>
              <div className="text-[10px] text-gray-500">Something is broken</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <Ban className="w-4 h-4 text-amber-500" />
            <div>
              <div className="text-xs text-amber-400 font-medium">Blocked</div>
              <div className="text-[10px] text-gray-500">Can't test — something else is broken</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-700/50 border border-gray-600/30 rounded-lg px-3 py-2">
            <ChevronRight className="w-4 h-4 text-gray-500" />
            <div>
              <div className="text-xs text-gray-400 font-medium">Skip</div>
              <div className="text-[10px] text-gray-500">Not applicable to me</div>
            </div>
          </div>
        </div>
        <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2">
          <p className="text-[11px] text-red-300"><strong>If you click Fail or Blocked</strong> — you MUST describe what happened. "It didn't work" isn't enough. Tell us what you clicked, what you expected, and what actually happened.</p>
        </div>
      </div>
    ),
  },
  {
    icon: Camera,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    title: 'Pro Tip: Screenshots',
    subtitle: 'A picture is worth a thousand words',
    body: "If something looks wrong, take a screenshot first. On Mac: Cmd+Shift+4 to capture an area. Then paste it right into the feedback box with Cmd+V. This helps us fix things 10x faster.",
    visual: (
      <div className="bg-gray-900 rounded-xl p-4 mt-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
            <kbd className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">⌘</kbd>
            <kbd className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">⇧</kbd>
            <kbd className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">4</kbd>
            <span className="text-[10px] text-gray-500 ml-1">capture</span>
          </div>
          <ArrowRight className="w-3 h-3 text-gray-600" />
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
            <kbd className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">⌘</kbd>
            <kbd className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">V</kbd>
            <span className="text-[10px] text-gray-500 ml-1">paste into feedback</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Sparkles,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/15',
    border: 'border-yellow-500/30',
    title: "You're Ready!",
    subtitle: 'Your feedback makes MicroGRID better',
    body: "That's everything. Click the button below to start testing. Remember — there are no wrong answers. If something confuses you, that's a bug too. Report it.",
    visual: (
      <div className="bg-gray-900 rounded-xl p-4 mt-4 space-y-2">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-yellow-400" />
          <span className="text-xs text-gray-300">Complete all tests in a plan to earn a badge</span>
        </div>
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-gray-300">Click the <strong>?</strong> button anytime to see these instructions again</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-green-400" />
          <span className="text-xs text-gray-300">Questions? Message Greg or comment on any test result</span>
        </div>
      </div>
    ),
  },
]

export function HelpModal({ onClose }: HelpModalProps) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-green-500' : i < step ? 'w-1.5 bg-green-500/40' : 'w-1.5 bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>

        {/* Content */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-10 h-10 rounded-xl ${current.bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${current.color}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{current.title}</h2>
              <p className="text-xs text-gray-400">{current.subtitle}</p>
            </div>
          </div>

          <p className="text-sm text-gray-300 mt-4 leading-relaxed">{current.body}</p>

          {current.visual}
        </div>

        {/* Navigation */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-4 rounded-b-2xl flex items-center justify-between">
          {!isFirst ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          <span className="text-xs text-gray-500">{step + 1} of {STEPS.length}</span>

          {isLast ? (
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors"
            >
              Start Testing
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
