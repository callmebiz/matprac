import type { Topic } from '../types'

export const topics: Topic[] = [
  {
    id: 'percentages',
    name: 'Percentages & Mental Math',
    shortName: 'Percentages',
    description: 'Quick arithmetic, ratios, percentages, and estimation.',
    color: 'emerald',
    icon: '%',
  },
  {
    id: 'linear-algebra',
    name: 'Linear Algebra',
    shortName: 'Lin. Algebra',
    description: 'Vectors, matrices, eigenvalues, SVD, and norms.',
    color: 'blue',
    icon: '⟦A⟧',
  },
  {
    id: 'probability',
    name: 'Probability & Statistics',
    shortName: 'Prob. & Stats',
    description: 'Distributions, Bayes’ theorem, hypothesis testing, expectation.',
    color: 'amber',
    icon: 'P(x)',
  },
  {
    id: 'calculus-ml',
    name: 'Calculus, Optimization & ML Theory',
    shortName: 'Calc & ML',
    description: 'Gradients, backprop, loss functions, entropy, attention math.',
    color: 'violet',
    icon: '∇',
  },
]

export const topicById = new Map(topics.map((t) => [t.id, t]))
