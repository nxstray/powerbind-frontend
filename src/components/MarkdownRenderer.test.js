import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

import MarkdownRenderer from '@/components/MarkdownRenderer.vue'

// mermaid is a heavy optional dependency that MarkdownRenderer lazy-loads on the
// first ```mermaid block — mocked here so the diagram path can be asserted
// without pulling the real library (and its renderer) into the unit test.
const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}))

vi.mock('mermaid', () => ({ default: mermaidMock }))

const MERMAID_CODE = 'graph TD;\nA-->B;'
const MERMAID_CONTENT = '```mermaid\n' + MERMAID_CODE + '\n```'

describe('MarkdownRenderer', () => {
  afterEach(() => {
    mermaidMock.initialize.mockClear()
    mermaidMock.render.mockReset()
    // Tests import a fresh copy of the component, so the module registry is
    // cleared between them; each mermaid test re-registers its own mock.
    vi.resetModules()
  })

  // Fresh module instance per call: MarkdownRenderer caches the mermaid promise at
  // module scope, so a new instance is what makes initialize() observable again.
  // The mount is attached to the document because renderMermaidBlocks() looks its
  // placeholder up with document.getElementById().
  async function mountWithMermaid(props) {
    vi.resetModules()
    vi.doMock('mermaid', () => ({ default: mermaidMock }))
    const Fresh = (await import('@/components/MarkdownRenderer.vue')).default
    const wrapper = mount(Fresh, { props, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  // The mermaid path is lazy (dynamic import + async render), so the diagram
  // assertions poll instead of relying on a single microtask flush.
  async function waitFor(check, timeout = 2000) {
    const deadline = Date.now() + timeout
    while (!check() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    return check()
  }

  const containerHtml = (wrapper) => wrapper.find('.mermaid-container').element.innerHTML

  it('me-render teks markdown standar dengan aman', async () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: '**teks tebal** dan *miring*',
      },
    })

    await flushPromises()

    expect(wrapper.html()).toContain('<strong>teks tebal</strong>')
    expect(wrapper.html()).toContain('<em>miring</em>')
  })

  it('membersihkan tag skrip berbahaya (XSS sanitization)', async () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: 'Halo <script>alert("xss")</script> Dunia',
      },
    })

    await flushPromises()

    expect(wrapper.html()).not.toContain('<script>')
    expect(wrapper.text()).toContain('Halo')
    expect(wrapper.text()).toContain('Dunia')
  })

  it('mengganti blok mermaid dengan placeholder container', async () => {
    mermaidMock.render.mockResolvedValue({ svg: '<svg><rect width="4" height="4" /></svg>' })

    const wrapper = await mountWithMermaid({ content: MERMAID_CONTENT })
    await waitFor(() => containerHtml(wrapper).includes('<svg'))

    expect(wrapper.find('.mermaid-container').exists()).toBe(true)
    // The raw ```mermaid fence is never rendered as a plain code block.
    expect(wrapper.text()).not.toContain('graph TD;')
  })

  it('menyuntikkan SVG hasil render mermaid ke dalam placeholder', async () => {
    mermaidMock.render.mockResolvedValue({ svg: '<svg class="diagram"><rect width="4" height="4" /></svg>' })

    const wrapper = await mountWithMermaid({ content: MERMAID_CONTENT })
    await waitFor(() => mermaidMock.render.mock.calls.length > 0 && containerHtml(wrapper).includes('diagram'))

    expect(mermaidMock.initialize).toHaveBeenCalledWith(expect.objectContaining({ startOnLoad: false }))
    expect(mermaidMock.render).toHaveBeenCalledWith(expect.stringMatching(/-svg$/), MERMAID_CODE)
    expect(containerHtml(wrapper)).toContain('diagram')
  })

  it('menampilkan pesan error bila render diagram gagal', async () => {
    mermaidMock.render.mockRejectedValue(new Error('parse error'))

    const wrapper = await mountWithMermaid({ content: MERMAID_CONTENT })
    await waitFor(() => containerHtml(wrapper).includes('Diagram error'))

    expect(containerHtml(wrapper)).toContain('Diagram error: unable to render')
  })

  it('menampilkan pesan error bila modul mermaid gagal dimuat', async () => {
    // A module without a default export makes loadMermaid() reject, which must be
    // surfaced as an inline error instead of breaking the whole message render.
    vi.resetModules()
    vi.doMock('mermaid', () => ({}))
    const BrokenRenderer = (await import('@/components/MarkdownRenderer.vue')).default

    const wrapper = mount(BrokenRenderer, {
      props: { content: `sebelum\n\n${MERMAID_CONTENT}\n\nsesudah` },
      attachTo: document.body,
    })
    await flushPromises()
    await waitFor(() => containerHtml(wrapper).includes('Diagram error'))

    expect(containerHtml(wrapper)).toContain('Diagram error: unable to render')
    expect(wrapper.text()).toContain('sebelum')
    expect(wrapper.text()).toContain('sesudah')
  })

  it('me-render string kosong tanpa error', async () => {
    const wrapper = mount(MarkdownRenderer, { props: { content: '' } })

    await flushPromises()

    expect(wrapper.find('.markdown-body').exists()).toBe(true)
    expect(wrapper.text()).toBe('')
  })

  it('me-render ulang saat prop content berubah', async () => {
    const wrapper = mount(MarkdownRenderer, { props: { content: '**pertama**' } })
    await flushPromises()
    expect(wrapper.html()).toContain('<strong>pertama</strong>')

    await wrapper.setProps({ content: '**kedua**' })
    await flushPromises()

    expect(wrapper.html()).toContain('<strong>kedua</strong>')
    expect(wrapper.html()).not.toContain('pertama')
  })
})

