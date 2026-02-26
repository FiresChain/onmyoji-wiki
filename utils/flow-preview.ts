export type GraphData = {
  nodes: any[]
  edges: any[]
}

const DEFAULT_NODE_WIDTH = 180
const DEFAULT_NODE_HEIGHT = 100
const VIEWPORT_PADDING = 80

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

const resolveNodeSize = (node: any) => {
  const style = node?.properties?.style || {}
  const width = toNumber(node?.width ?? style?.width ?? node?.properties?.width, DEFAULT_NODE_WIDTH)
  const height = toNumber(node?.height ?? style?.height ?? node?.properties?.height, DEFAULT_NODE_HEIGHT)
  return { width, height }
}

export const normalizeGraphData = (input: any): GraphData => {
  if (!input || typeof input !== 'object') {
    return { nodes: [], edges: [] }
  }

  if (Array.isArray(input.fileList) && input.fileList.length > 0) {
    const activeFileId = typeof input.activeFileId === 'string' ? input.activeFileId : ''
    const activeIndex = input.fileList.findIndex((item: any) => item?.id === activeFileId)
    const targetIndex = activeIndex >= 0 ? activeIndex : 0
    const graphRawData = input.fileList[targetIndex]?.graphRawData
    if (graphRawData && typeof graphRawData === 'object') {
      return {
        nodes: Array.isArray(graphRawData.nodes) ? graphRawData.nodes : [],
        edges: Array.isArray(graphRawData.edges) ? graphRawData.edges : []
      }
    }
  }

  return {
    nodes: Array.isArray(input.nodes) ? input.nodes : [],
    edges: Array.isArray(input.edges) ? input.edges : []
  }
}

export const normalizeGraphForPreview = (graphData: GraphData, padding = VIEWPORT_PADDING): GraphData => {
  if (!graphData || !Array.isArray(graphData.nodes) || graphData.nodes.length === 0) {
    return { nodes: [], edges: Array.isArray(graphData?.edges) ? graphData.edges : [] }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY

  graphData.nodes.forEach((node) => {
    const x = toNumber(node?.x, 0)
    const y = toNumber(node?.y, 0)
    const { width, height } = resolveNodeSize(node)
    minX = Math.min(minX, x - width / 2)
    minY = Math.min(minY, y - height / 2)
  })

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return graphData
  }

  const offsetX = padding - minX
  const offsetY = padding - minY

  if (Math.abs(offsetX) < 1 && Math.abs(offsetY) < 1) {
    return graphData
  }

  return {
    ...graphData,
    nodes: graphData.nodes.map((node) => ({
      ...node,
      x: toNumber(node?.x, 0) + offsetX,
      y: toNumber(node?.y, 0) + offsetY
    }))
  }
}

