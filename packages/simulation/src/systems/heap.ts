/** Binary min-heap of node indices keyed by float priority; ties break on the lower node index. */
export class MinHeap {
  private nodes: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, key: number): void {
    const nodes = this.nodes;
    const keys = this.keys;
    let i = nodes.length;
    nodes.push(node);
    keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  /** Removes the minimum; returns the node, with its key available via `lastKey`. */
  pop(): number {
    const nodes = this.nodes;
    const keys = this.keys;
    const top = nodes[0] as number;
    this.lastKey = keys[0] as number;
    const lastNode = nodes.pop() as number;
    const lastKey = keys.pop() as number;
    if (nodes.length > 0) {
      nodes[0] = lastNode;
      keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < nodes.length && this.less(l, m)) m = l;
        if (r < nodes.length && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  lastKey = 0;

  private less(a: number, b: number): boolean {
    const ka = this.keys[a] as number;
    const kb = this.keys[b] as number;
    return ka < kb || (ka === kb && (this.nodes[a] as number) < (this.nodes[b] as number));
  }

  private swap(a: number, b: number): void {
    const n = this.nodes;
    const k = this.keys;
    const tn = n[a] as number;
    n[a] = n[b] as number;
    n[b] = tn;
    const tk = k[a] as number;
    k[a] = k[b] as number;
    k[b] = tk;
  }
}
