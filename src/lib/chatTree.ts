import type { ChatMessage } from '../llm'

export interface ChatNode {
  id: string
  message: ChatMessage
  parentId: string | null
  childIds: string[]
}

export interface ChatTree {
  nodes: Record<string, ChatNode>
  rootIds: string[]
  /** Which child index is "active" (displayed) at each branch point, keyed by parentId, '' for the root level. */
  activeIndex: Record<string, number>
}

const ROOT_KEY = ''

export function emptyTree(): ChatTree {
  return { nodes: {}, rootIds: [], activeIndex: {} }
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Appends a new node as a child of parentId (or as a new top-level root if parentId is null), and
 * marks it as the active branch at that point -- editing a message or regenerating a reply always
 * jumps straight to the new version, with the old one still reachable via the sibling nav.
 */
export function appendNode(tree: ChatTree, parentId: string | null, message: ChatMessage): { tree: ChatTree; nodeId: string } {
  const id = newId()
  const node: ChatNode = { id, message, parentId, childIds: [] }
  const nodes = { ...tree.nodes, [id]: node }

  let rootIds = tree.rootIds
  if (parentId === null) {
    rootIds = [...tree.rootIds, id]
  } else {
    const parent = nodes[parentId]
    nodes[parentId] = { ...parent, childIds: [...parent.childIds, id] }
  }

  const key = parentId ?? ROOT_KEY
  const siblingCount = parentId === null ? rootIds.length : nodes[parentId].childIds.length
  const activeIndex = { ...tree.activeIndex, [key]: siblingCount - 1 }

  return { tree: { nodes, rootIds, activeIndex }, nodeId: id }
}

export function setActiveIndex(tree: ChatTree, key: string, index: number): ChatTree {
  return { ...tree, activeIndex: { ...tree.activeIndex, [key]: index } }
}

/** The currently displayed linear conversation, following activeIndex at each branch point. */
export function activePath(tree: ChatTree): ChatNode[] {
  const path: ChatNode[] = []
  let childIds = tree.rootIds
  let key = ROOT_KEY
  while (childIds.length > 0) {
    const idx = Math.min(tree.activeIndex[key] ?? childIds.length - 1, childIds.length - 1)
    const node = tree.nodes[childIds[idx]]
    path.push(node)
    key = node.id
    childIds = node.childIds
  }
  return path
}

/** Sibling position for a node if it has any (i.e. its parent/root level has >1 child) -- drives the ‹ i/n › nav. */
export function siblingInfo(tree: ChatTree, nodeId: string): { key: string; index: number; count: number } | null {
  const node = tree.nodes[nodeId]
  const key = node.parentId ?? ROOT_KEY
  const childIds = node.parentId === null ? tree.rootIds : tree.nodes[node.parentId].childIds
  if (childIds.length <= 1) return null
  return { key, index: childIds.indexOf(nodeId), count: childIds.length }
}

/** Messages from the root down to and including nodeId -- the context to send the model from that point. */
export function pathTo(tree: ChatTree, nodeId: string): ChatMessage[] {
  const messages: ChatMessage[] = []
  let current: ChatNode | undefined = tree.nodes[nodeId]
  while (current) {
    messages.unshift(current.message)
    current = current.parentId ? tree.nodes[current.parentId] : undefined
  }
  return messages
}
