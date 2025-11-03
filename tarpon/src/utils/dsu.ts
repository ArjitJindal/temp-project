export class DSU {
  private parent: Map<string, string>

  constructor() {
    this.parent = new Map()
  }

  find(x: string): string {
    let parentValue = this.parent.get(x)

    // Initialize if not present
    if (parentValue === undefined) {
      this.parent.set(x, x)
      parentValue = x
    }

    // Path compression
    if (parentValue !== x) {
      const root = this.find(parentValue)
      this.parent.set(x, root)
      return root
    }

    return x
  }

  union(a: string, b: string): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) {
      this.parent.set(rootA, rootB)
    }
  }
}
