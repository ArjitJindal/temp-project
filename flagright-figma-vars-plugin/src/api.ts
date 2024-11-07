import { Request, RequestError } from './request'

export interface SearchResult<T> {
  incomplete_results: boolean
  items: T[]
  total_count: 0
}

export class Api {
  private request: Request
  private org: string
  private repo: string
  constructor(request: Request, org: string, repo: string) {
    this.request = request
    this.org = org
    this.repo = repo
  }

  async getPrList(): Promise<
    {
      number: number
      title: string
    }[]
  > {
    return await this.request.fetch(
      'GET',
      `/repos/${this.org}/${this.repo}/pulls`
    )
  }

  async searchPrs(
    params: { filterTitle?: string; filterLabels?: string[] } = {}
  ): Promise<
    SearchResult<{
      number: number
      title: string
      html_url: string
    }>
  > {
    const query = [
      `state:open`,
      `type:pr`,
      `repo:${this.org}/${this.repo}`,
      params.filterTitle && `"${params.filterTitle}" in:title`,
      params.filterLabels?.map((x) => `label:${x}`).join(' '),
    ]
      .filter((x) => !!x)
      .join(' ')
    return await this.request.fetch(
      'GET',
      `/search/issues?q=${encodeURIComponent(query)}`
    )
  }

  async getBranch(branchName: string): Promise<{
    commit: {
      sha: string
      commit: {
        tree: {
          sha: string
        }
      }
    }
  }> {
    return await this.request.fetch(
      'GET',
      `/repos/${this.org}/${this.repo}/branches/${branchName}`
    )
  }

  async createBranch(
    commit: {
      sha: string
    },
    params: {
      branchName: string
    }
  ): Promise<{ number: number }> {
    return await this.request.fetch<{ number: number }>(
      'POST',
      `/repos/${this.org}/${this.repo}/git/refs`,
      {
        ref: `refs/heads/${params.branchName}`,
        sha: commit.sha,
      }
    )
  }

  async updateBranch(
    branchName: string,
    commit: {
      sha: string
    }
  ): Promise<{ number: number }> {
    return await this.request.fetch<{ number: number }>(
      'PATCH',
      `/repos/${this.org}/${this.repo}/git/refs/heads/${branchName}`,
      {
        sha: commit.sha,
        force: true,
      }
    )
  }

  async createCommit(
    parentCommit: {
      sha: string
      commit: {
        tree: {
          sha: string
        }
      }
    },
    params: {
      date: Date
      files: {
        name: string
        content: string
      }[]
      message: string
    }
  ): Promise<{ sha: string }> {
    const newBlobs: { name: string; sha: string }[] = await Promise.all(
      params.files.map(async ({ name, content }) => {
        const { sha } = await this.request.fetch<{
          sha: string
          url: string
        }>('POST', `/repos/${this.org}/${this.repo}/git/blobs`, {
          content: content,
          encoding: 'utf-8',
        })
        return {
          name,
          sha,
        }
      })
    )

    // Create tree
    const newTree = await this.request.fetch<{
      sha: string
      url: string
      tree: unknown
    }>('POST', `/repos/${this.org}/${this.repo}/git/trees`, {
      base_tree: parentCommit.commit.tree.sha,
      tree: newBlobs.map(({ name, sha }) => ({
        path: name,
        mode: '100644',
        type: 'blob',
        sha: sha,
      })),
    })

    // Create commit
    return await this.request.fetch<{ sha: string }>(
      'POST',
      `/repos/${this.org}/${this.repo}/git/commits`,
      {
        message: params.message,
        author: {
          name: 'Figma Bot',
          email: 'figma@flagright.com',
          date: params.date.toISOString(),
        },
        parents: [parentCommit.sha],
        tree: newTree.sha,
        // signature:
        //   '-----BEGIN PGP SIGNATURE-----\n\niQIzBAABAQAdFiEESn/54jMNIrGSE6Tp6cQjvhfv7nAFAlnT71cACgkQ6cQjvhfv\n7nCWwA//XVqBKWO0zF+bZl6pggvky3Oc2j1pNFuRWZ29LXpNuD5WUGXGG209B0hI\nDkmcGk19ZKUTnEUJV2Xd0R7AW01S/YSub7OYcgBkI7qUE13FVHN5ln1KvH2all2n\n2+JCV1HcJLEoTjqIFZSSu/sMdhkLQ9/NsmMAzpf/iIM0nQOyU4YRex9eD1bYj6nA\nOQPIDdAuaTQj1gFPHYLzM4zJnCqGdRlg0sOM/zC5apBNzIwlgREatOYQSCfCKV7k\nnrU34X8b9BzQaUx48Qa+Dmfn5KQ8dl27RNeWAqlkuWyv3pUauH9UeYW+KyuJeMkU\n+NyHgAsWFaCFl23kCHThbLStMZOYEnGagrd0hnm1TPS4GJkV4wfYMwnI4KuSlHKB\njHl3Js9vNzEUQipQJbgCgTiWvRJoK3ENwBTMVkKHaqT4x9U4Jk/XZB6Q8MA09ezJ\n3QgiTjTAGcum9E9QiJqMYdWQPWkaBIRRz5cET6HPB48YNXAAUsfmuYsGrnVLYbG+\nUpC6I97VybYHTy2O9XSGoaLeMI9CsFn38ycAxxbWagk5mhclNTP5mezIq6wKSwmr\nX11FW3n1J23fWZn5HJMBsRnUCgzqzX3871IqLYHqRJ/bpZ4h20RhTyPj5c/z7QXp\neSakNQMfbbMcljkha+ZMuVQX1K9aRlVqbmv3ZMWh+OijLYVU2bc=\n=5Io4\n-----END PGP SIGNATURE-----\n',
      }
    )
  }

  async createPr(params: {
    base: string
    head: string
    title: string
    body: string
    draft: boolean
    labels?: string[]
  }): Promise<{ number: number; html_url: string }> {
    const newPr = await this.request.fetch<{
      number: number
      html_url: string
    }>('POST', `/repos/${this.org}/${this.repo}/pulls`, {
      title: params.title,
      body: params.body,
      head: params.head,
      base: params.base,
      draft: params.draft,
    })
    if (params.labels) {
      await this.request.fetch<{
        number: number
        html_url: string
      }>(
        'PUT',
        `/repos/${this.org}/${this.repo}/issues/${newPr.number}/labels`,
        { labels: params.labels }
      )
    }
    return newPr
  }

  async getPr(number: number): Promise<{
    number: number
    html_url: string
    head: {
      ref: string
      sha: string
    }
  }> {
    return await this.request.fetch(
      'GET',
      `/repos/${this.org}/${this.repo}/pulls/${number}`
    )
  }

  async getFileContent(
    path: string,
    ref?: string
  ): Promise<{
    content: string
  } | null> {
    try {
      return await this.request.fetch(
        'GET',
        `/repos/${this.org}/${this.repo}/contents/${path}` +
          (ref ? `?ref=${ref}` : ''),
        undefined,
        {
          Accept: 'application/vnd.github.object+json',
        }
      )
    } catch (e) {
      if (e instanceof RequestError) {
        return null
      }
      throw e
    }
  }
}
